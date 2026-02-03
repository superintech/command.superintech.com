import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { UserRole, UserStatus, VisibilityScope } from '@prisma/client';

// Default permissions for each role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [], // Admin gets all - handled separately
  MANAGER: [
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.change_status',
    'projects.view', 'projects.create', 'projects.edit', 'projects.manage_members',
    'teams.view', 'teams.edit', 'teams.manage_members',
    'reports.view', 'reports.view_all', 'reports.score_employees', 'reports.export',
    'users.view', 'users.invite', 'users.edit',
    'files.view', 'files.upload', 'files.delete', 'files.share',
  ],
  EMPLOYEE: [
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.change_status',
    'projects.view',
    'teams.view',
    'reports.view',
    'users.view',
    'files.view', 'files.upload', 'files.share',
  ],
};

// Helper: Check if user has permission
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      permissions: {
        include: { permission: true }
      }
    }
  });

  if (!user) return false;

  // Admin has all permissions
  if (user.role === 'ADMIN') return true;

  // Check user-specific permission override
  const userPermission = user.permissions.find(p => p.permission.code === permissionCode);
  if (userPermission) {
    return userPermission.granted;
  }

  // Fall back to role default
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return rolePermissions.includes(permissionCode);
}

// Helper: Get all permissions for a user
export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      permissions: {
        include: { permission: true }
      }
    }
  });

  if (!user) return [];

  // Admin has all permissions
  if (user.role === 'ADMIN') {
    const allPermissions = await prisma.permission.findMany();
    return allPermissions.map(p => p.code);
  }

  // Start with role defaults
  const rolePermissions = new Set(ROLE_PERMISSIONS[user.role] || []);

  // Apply user-specific overrides
  for (const up of user.permissions) {
    if (up.granted) {
      rolePermissions.add(up.permission.code);
    } else {
      rolePermissions.delete(up.permission.code);
    }
  }

  return Array.from(rolePermissions);
}

// ==================== USER CRUD ====================

// Get all users
export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { teamId, departmentId, role, status, search } = req.query;

    const canViewAll = await hasPermission(userId, 'users.view_all');
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { teamMembers: true }
    });

    // Build where clause
    const where: any = {};

    // Apply visibility scope for non-admins
    if (!canViewAll && currentUser?.visibilityScope === 'TEAM_ONLY') {
      const teamIds = currentUser.teamMembers.map(tm => tm.teamId);
      if (teamIds.length > 0) {
        where.teamMembers = {
          some: { teamId: { in: teamIds } }
        };
      }
    }

    if (teamId) {
      where.teamMembers = { some: { teamId: teamId as string } };
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        phone: true,
        designation: true,
        joinDate: true,
        departmentId: true,
        visibilityScope: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        department: {
          select: { id: true, name: true, code: true }
        },
        teamMembers: {
          include: {
            team: { select: { id: true, name: true } }
          }
        },
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
}

// Get single user
export async function getUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        teamMembers: {
          include: { team: true }
        },
        profile: true,
        permissions: {
          include: { permission: true }
        },
      }
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Get effective permissions
    const effectivePermissions = await getUserPermissions(id);

    // Remove sensitive data
    const { passwordHash, ...userData } = user;

    res.json({
      success: true,
      data: {
        ...userData,
        effectivePermissions
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
}

// Create user directly
export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const creatorId = req.user!.id;

    // Check permission
    if (!await hasPermission(creatorId, 'users.create')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const {
      email,
      password,
      name,
      role = 'EMPLOYEE',
      departmentId,
      phone,
      designation,
      joinDate,
      teamIds = [],
    } = req.body;

    // Validate required fields
    if (!email || !name) {
      res.status(400).json({ success: false, error: 'Email and name are required' });
      return;
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already in use' });
      return;
    }

    // Hash password if provided, otherwise set to null (user will set on first login)
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: role as UserRole,
        status: password ? 'ACTIVE' : 'PENDING',
        departmentId,
        phone,
        designation,
        joinDate: joinDate ? new Date(joinDate) : undefined,
        createdById: creatorId,
      },
      include: {
        department: true,
      }
    });

    // Add to teams
    if (teamIds.length > 0) {
      await prisma.teamMember.createMany({
        data: teamIds.map((teamId: string) => ({
          teamId,
          userId: user.id,
        })),
        skipDuplicates: true,
      });
    }

    // Add to general chat room
    const generalChat = await prisma.chatRoom.findFirst({
      where: { type: 'GENERAL' }
    });
    if (generalChat) {
      await prisma.chatRoomMember.create({
        data: { roomId: generalChat.id, userId: user.id }
      }).catch(() => {}); // Ignore if already exists
    }

    const { passwordHash: _, ...userData } = user;
    res.status(201).json({ success: true, data: userData });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
}

// Update user
export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const editorId = req.user!.id;

    // Check permission (users can edit themselves, or need users.edit permission)
    if (id !== editorId && !await hasPermission(editorId, 'users.edit')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const {
      name,
      email,
      phone,
      designation,
      departmentId,
      joinDate,
      avatar,
      role,
      status,
      visibilityScope,
    } = req.body;

    // Role changes require special permission
    if (role && !await hasPermission(editorId, 'users.manage_roles')) {
      res.status(403).json({ success: false, error: 'Cannot change user role' });
      return;
    }

    const updateData: any = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (designation !== undefined) updateData.designation = designation;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (joinDate !== undefined) updateData.joinDate = joinDate ? new Date(joinDate) : null;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (role) updateData.role = role as UserRole;
    if (status) updateData.status = status as UserStatus;
    if (visibilityScope) updateData.visibilityScope = visibilityScope as VisibilityScope;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        teamMembers: { include: { team: true } },
      }
    });

    const { passwordHash, ...userData } = user;
    res.json({ success: true, data: userData });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
}

// Reset user password (Admin only)
export async function resetUserPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    // Only admins can reset passwords
    if (!await hasPermission(adminId, 'users.manage_permissions')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const { password } = req.body;

    if (!password || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Prevent resetting own password through this endpoint
    if (id === adminId) {
      res.status(400).json({ success: false, error: 'Cannot reset your own password through this endpoint' });
      return;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and set status to ACTIVE if it was PENDING
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        status: user.status === 'PENDING' ? 'ACTIVE' : user.status,
      }
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
}

// Delete/deactivate user
export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deleterId = req.user!.id;

    if (!await hasPermission(deleterId, 'users.delete')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    // Soft delete - just deactivate
    await prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        isActive: false,
      }
    });

    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
}

// ==================== USER PROFILE ====================

// Get user profile
export async function getUserProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const profile = await prisma.userProfile.findUnique({
      where: { userId: id },
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
}

// Update user profile
export async function updateUserProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const editorId = req.user!.id;

    // Check permission
    if (id !== editorId && !await hasPermission(editorId, 'users.edit')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const profileData = req.body;

    const profile = await prisma.userProfile.upsert({
      where: { userId: id },
      update: profileData,
      create: {
        userId: id,
        ...profileData,
      }
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
}

// ==================== PERMISSIONS ====================

// Get all permissions
export async function getPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    // Group by category
    const grouped = permissions.reduce((acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    }, {} as Record<string, typeof permissions>);

    res.json({ success: true, data: { permissions, grouped } });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch permissions' });
  }
}

// Update user permissions
export async function updateUserPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const editorId = req.user!.id;

    if (!await hasPermission(editorId, 'users.manage_permissions')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const { permissions } = req.body; // Array of { permissionId, granted }

    // Delete existing user permissions
    await prisma.userPermission.deleteMany({
      where: { userId: id }
    });

    // Create new permissions
    if (permissions && permissions.length > 0) {
      await prisma.userPermission.createMany({
        data: permissions.map((p: { permissionId: string; granted: boolean }) => ({
          userId: id,
          permissionId: p.permissionId,
          granted: p.granted,
        }))
      });
    }

    res.json({ success: true, message: 'Permissions updated' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ success: false, error: 'Failed to update permissions' });
  }
}

// Get current user's permissions
export async function getMyPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const permissions = await getUserPermissions(userId);

    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch permissions' });
  }
}

// ==================== INVITATIONS ====================

// Send invitation
export async function sendInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const senderId = req.user!.id;

    if (!await hasPermission(senderId, 'users.invite')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const { email, name, role = 'EMPLOYEE', departmentId, teamIds = [] } = req.body;

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      res.status(400).json({ success: false, error: 'User with this email already exists' });
      return;
    }

    // Check for pending invitation
    const existingInvite = await prisma.userInvitation.findFirst({
      where: { email: email.toLowerCase(), status: 'PENDING' }
    });
    if (existingInvite) {
      res.status(400).json({ success: false, error: 'Invitation already sent to this email' });
      return;
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await prisma.userInvitation.create({
      data: {
        email: email.toLowerCase(),
        name,
        role: role as UserRole,
        departmentId,
        teamIds,
        token,
        invitedById: senderId,
        expiresAt,
      },
      include: {
        invitedBy: { select: { name: true, email: true } }
      }
    });

    // TODO: Send email with invitation link
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3006'}/invite/${token}`;

    res.status(201).json({
      success: true,
      data: invitation,
      inviteUrl,
      message: 'Invitation created. Send this link to the user.'
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to send invitation' });
  }
}

// Get invitations
export async function getInvitations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const invitations = await prisma.userInvitation.findMany({
      where,
      include: {
        invitedBy: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: invitations });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invitations' });
  }
}

// Get invitation by token (public)
export async function getInvitationByToken(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { token } = req.params;

    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        expiresAt: true,
        invitedBy: { select: { name: true } }
      }
    });

    if (!invitation) {
      res.status(404).json({ success: false, error: 'Invalid invitation' });
      return;
    }

    if (invitation.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Invitation already used or cancelled' });
      return;
    }

    if (new Date() > invitation.expiresAt) {
      res.status(400).json({ success: false, error: 'Invitation has expired' });
      return;
    }

    res.json({ success: true, data: invitation });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invitation' });
  }
}

// Accept invitation (public endpoint)
export async function acceptInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { token } = req.params;
    const { password, name } = req.body;

    const invitation = await prisma.userInvitation.findUnique({
      where: { token }
    });

    if (!invitation) {
      res.status(404).json({ success: false, error: 'Invalid invitation' });
      return;
    }

    if (invitation.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Invitation already used or expired' });
      return;
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' }
      });
      res.status(400).json({ success: false, error: 'Invitation has expired' });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        name: name || invitation.name || invitation.email.split('@')[0],
        role: invitation.role,
        departmentId: invitation.departmentId,
        status: 'ACTIVE',
        createdById: invitation.invitedById,
      }
    });

    // Add to teams
    if (invitation.teamIds.length > 0) {
      await prisma.teamMember.createMany({
        data: invitation.teamIds.map(teamId => ({
          teamId,
          userId: user.id,
        })),
        skipDuplicates: true,
      });
    }

    // Add to general chat
    const generalChat = await prisma.chatRoom.findFirst({
      where: { type: 'GENERAL' }
    });
    if (generalChat) {
      await prisma.chatRoomMember.create({
        data: { roomId: generalChat.id, userId: user.id }
      }).catch(() => {});
    }

    // Update invitation status
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() }
    });

    res.json({ success: true, message: 'Account created successfully. You can now login.' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept invitation' });
  }
}

// Resend invitation
export async function resendInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const senderId = req.user!.id;

    if (!await hasPermission(senderId, 'users.invite')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const invitation = await prisma.userInvitation.findUnique({
      where: { id }
    });

    if (!invitation) {
      res.status(404).json({ success: false, error: 'Invitation not found' });
      return;
    }

    // Generate new token and extend expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const updated = await prisma.userInvitation.update({
      where: { id },
      data: {
        token,
        expiresAt,
        status: 'PENDING',
      }
    });

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3006'}/invite/${token}`;

    res.json({
      success: true,
      data: updated,
      inviteUrl,
      message: 'Invitation resent'
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend invitation' });
  }
}

// Cancel invitation
export async function cancelInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!await hasPermission(userId, 'users.invite')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    await prisma.userInvitation.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({ success: true, message: 'Invitation cancelled' });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel invitation' });
  }
}

// ==================== TEAMS ====================

// Get all teams
export async function getTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const teams = await prisma.team.findMany({
      include: {
        manager: { select: { id: true, name: true, avatar: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true, role: true, designation: true } }
          }
        },
        _count: { select: { members: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: teams });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch teams' });
  }
}

// Get single team
export async function getTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, avatar: true, email: true } },
        members: {
          include: {
            user: {
              select: {
                id: true, name: true, avatar: true, email: true,
                role: true, designation: true, department: true
              }
            }
          }
        },
      }
    });

    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    res.json({ success: true, data: team });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch team' });
  }
}

// Create team
export async function createTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    if (!await hasPermission(userId, 'teams.create')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const { name, description, managerId, memberIds = [] } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Team name is required' });
      return;
    }

    const team = await prisma.team.create({
      data: {
        name,
        description,
        managerId,
      },
      include: {
        manager: { select: { id: true, name: true, avatar: true } }
      }
    });

    // Add members
    const allMemberIds = new Set<string>(memberIds as string[]);
    if (managerId) allMemberIds.add(managerId);

    if (allMemberIds.size > 0) {
      await prisma.teamMember.createMany({
        data: Array.from(allMemberIds).map((memberId) => ({
          teamId: team.id,
          userId: memberId,
          role: memberId === managerId ? 'LEAD' : 'MEMBER',
        })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({ success: true, data: team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ success: false, error: 'Failed to create team' });
  }
}

// Update team
export async function updateTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!await hasPermission(userId, 'teams.edit')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const { name, description, managerId, isActive } = req.body;

    const team = await prisma.team.update({
      where: { id },
      data: { name, description, managerId, isActive },
      include: {
        manager: { select: { id: true, name: true, avatar: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true } }
          }
        }
      }
    });

    res.json({ success: true, data: team });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team' });
  }
}

// Delete team
export async function deleteTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!await hasPermission(userId, 'teams.delete')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    await prisma.team.delete({ where: { id } });

    res.json({ success: true, message: 'Team deleted' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team' });
  }
}

// Add team member
export async function addTeamMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!await hasPermission(userId, 'teams.manage_members')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const { memberId, role = 'MEMBER' } = req.body;

    const member = await prisma.teamMember.create({
      data: {
        teamId: id,
        userId: memberId,
        role,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true, email: true } }
      }
    });

    res.status(201).json({ success: true, data: member });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, error: 'User is already a team member' });
      return;
    }
    console.error('Add team member error:', error);
    res.status(500).json({ success: false, error: 'Failed to add team member' });
  }
}

// Remove team member
export async function removeTeamMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id, memberId } = req.params;
    const userId = req.user!.id;

    if (!await hasPermission(userId, 'teams.manage_members')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId: id, userId: memberId }
      }
    });

    res.json({ success: true, message: 'Member removed from team' });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove team member' });
  }
}

// Update user's teams (bulk)
export async function updateUserTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params; // user id
    const userId = req.user!.id;

    if (!await hasPermission(userId, 'teams.manage_members')) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    const { teamIds } = req.body; // Array of team IDs

    // Remove from all current teams
    await prisma.teamMember.deleteMany({
      where: { userId: id }
    });

    // Add to new teams
    if (teamIds && teamIds.length > 0) {
      await prisma.teamMember.createMany({
        data: teamIds.map((teamId: string) => ({
          teamId,
          userId: id,
        })),
        skipDuplicates: true,
      });
    }

    // Fetch updated teams
    const userTeams = await prisma.teamMember.findMany({
      where: { userId: id },
      include: { team: true }
    });

    res.json({ success: true, data: userTeams });
  } catch (error) {
    console.error('Update user teams error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user teams' });
  }
}
