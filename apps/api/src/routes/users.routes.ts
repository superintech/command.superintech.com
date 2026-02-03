import { Router } from 'express';
import {
  // Users
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getUserProfile,
  updateUserProfile,
  // Permissions
  getPermissions,
  updateUserPermissions,
  getMyPermissions,
  // Invitations
  sendInvitation,
  getInvitations,
  getInvitationByToken,
  acceptInvitation,
  resendInvitation,
  cancelInvitation,
  // Teams
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateUserTeams,
} from '../controllers/users.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ==================== PUBLIC ROUTES (no auth) ====================
// Invitation acceptance
router.get('/invite/:token', getInvitationByToken as any);
router.post('/invite/:token/accept', acceptInvitation as any);

// ==================== AUTHENTICATED ROUTES ====================
router.use(authenticate);

// Current user's permissions (must be before /:id)
router.get('/me/permissions', getMyPermissions);

// Invitations (must be before /:id)
router.get('/invitations', getInvitations);
router.post('/invitations', sendInvitation);
router.post('/invitations/:id/resend', resendInvitation);
router.delete('/invitations/:id', cancelInvitation);

// Teams (must be before /:id)
router.get('/teams', getTeams);
router.post('/teams', createTeam);
router.get('/teams/:teamId', getTeam);
router.patch('/teams/:teamId', updateTeam);
router.delete('/teams/:teamId', deleteTeam);
router.post('/teams/:teamId/members', addTeamMember);
router.delete('/teams/:teamId/members/:memberId', removeTeamMember);

// System permissions list (must be before /:id)
router.get('/permissions', getPermissions);

// Users CRUD (parameterized routes last)
router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

// User profile (HR info)
router.get('/:id/profile', getUserProfile);
router.patch('/:id/profile', updateUserProfile);

// User permissions management
router.patch('/:id/permissions', updateUserPermissions);

// Password reset (Admin only)
router.post('/:id/reset-password', resetUserPassword);

// User teams management
router.patch('/:id/teams', updateUserTeams);

export default router;
