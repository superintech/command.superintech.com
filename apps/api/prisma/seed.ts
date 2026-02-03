import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Define all permissions
const PERMISSIONS = [
  // Task permissions
  { code: 'tasks.view', name: 'View Tasks', description: 'Can view tasks', category: 'tasks' },
  { code: 'tasks.create', name: 'Create Tasks', description: 'Can create new tasks', category: 'tasks' },
  { code: 'tasks.edit', name: 'Edit Tasks', description: 'Can edit task details', category: 'tasks' },
  { code: 'tasks.delete', name: 'Delete Tasks', description: 'Can delete tasks', category: 'tasks' },
  { code: 'tasks.assign', name: 'Assign Tasks', description: 'Can assign tasks to users', category: 'tasks' },
  { code: 'tasks.change_status', name: 'Change Task Status', description: 'Can change task status', category: 'tasks' },

  // Project permissions
  { code: 'projects.view', name: 'View Projects', description: 'Can view projects', category: 'projects' },
  { code: 'projects.create', name: 'Create Projects', description: 'Can create new projects', category: 'projects' },
  { code: 'projects.edit', name: 'Edit Projects', description: 'Can edit project details', category: 'projects' },
  { code: 'projects.delete', name: 'Delete Projects', description: 'Can delete projects', category: 'projects' },
  { code: 'projects.manage_members', name: 'Manage Project Members', description: 'Can add/remove project members', category: 'projects' },

  // Team permissions
  { code: 'teams.view', name: 'View Teams', description: 'Can view teams', category: 'teams' },
  { code: 'teams.create', name: 'Create Teams', description: 'Can create new teams', category: 'teams' },
  { code: 'teams.edit', name: 'Edit Teams', description: 'Can edit team details', category: 'teams' },
  { code: 'teams.delete', name: 'Delete Teams', description: 'Can delete teams', category: 'teams' },
  { code: 'teams.manage_members', name: 'Manage Team Members', description: 'Can add/remove team members', category: 'teams' },

  // Reports & KPI permissions
  { code: 'reports.view', name: 'View Reports', description: 'Can view reports and analytics', category: 'reports' },
  { code: 'reports.view_all', name: 'View All Reports', description: 'Can view all users reports', category: 'reports' },
  { code: 'reports.score_employees', name: 'Score Employees', description: 'Can score employee KPIs', category: 'reports' },
  { code: 'reports.export', name: 'Export Reports', description: 'Can export reports', category: 'reports' },

  // User management permissions
  { code: 'users.view', name: 'View Users', description: 'Can view user list', category: 'users' },
  { code: 'users.view_all', name: 'View All Users', description: 'Can view all users regardless of team', category: 'users' },
  { code: 'users.create', name: 'Create Users', description: 'Can create new users directly', category: 'users' },
  { code: 'users.invite', name: 'Invite Users', description: 'Can send user invitations', category: 'users' },
  { code: 'users.edit', name: 'Edit Users', description: 'Can edit user profiles', category: 'users' },
  { code: 'users.delete', name: 'Delete Users', description: 'Can delete/deactivate users', category: 'users' },
  { code: 'users.manage_permissions', name: 'Manage Permissions', description: 'Can modify user permissions', category: 'users' },
  { code: 'users.manage_roles', name: 'Manage Roles', description: 'Can change user roles', category: 'users' },

  // File permissions
  { code: 'files.view', name: 'View Files', description: 'Can view files', category: 'files' },
  { code: 'files.upload', name: 'Upload Files', description: 'Can upload files', category: 'files' },
  { code: 'files.delete', name: 'Delete Files', description: 'Can delete files', category: 'files' },
  { code: 'files.share', name: 'Share Files', description: 'Can create share links', category: 'files' },

  // Admin permissions
  { code: 'admin.access', name: 'Admin Access', description: 'Full administrative access', category: 'admin' },
  { code: 'admin.settings', name: 'System Settings', description: 'Can modify system settings', category: 'admin' },
];

// Default permissions for each role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map(p => p.code), // Admin gets all permissions
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

async function seedPermissions() {
  console.log('📋 Seeding permissions...');

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name, description: permission.description, category: permission.category },
      create: permission,
    });
  }

  console.log(`✅ ${PERMISSIONS.length} permissions seeded`);
}

async function main() {
  console.log('🌱 Starting seed...');

  // Seed permissions first
  await seedPermissions();

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'MGMT' },
      update: {},
      create: { name: 'Management', code: 'MGMT' },
    }),
    prisma.department.upsert({
      where: { code: 'DEV' },
      update: {},
      create: { name: 'Development', code: 'DEV' },
    }),
    prisma.department.upsert({
      where: { code: 'DESIGN' },
      update: {},
      create: { name: 'Designing', code: 'DESIGN' },
    }),
    prisma.department.upsert({
      where: { code: 'GHL' },
      update: {},
      create: { name: 'GHL Development', code: 'GHL' },
    }),
  ]);

  console.log('✅ Departments created');

  const managementDept = departments[0];
  const devDept = departments[1];

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@superintech.com' },
    update: { role: UserRole.ADMIN },
    create: {
      email: 'admin@superintech.com',
      passwordHash: hashedPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
      departmentId: managementDept.id,
      isActive: true,
    },
  });

  console.log('✅ Admin user created');

  // Create sample manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@superintech.com' },
    update: {},
    create: {
      email: 'manager@superintech.com',
      passwordHash: hashedPassword,
      name: 'John Manager',
      role: UserRole.MANAGER,
      departmentId: devDept.id,
      isActive: true,
    },
  });

  console.log('✅ Manager user created');

  // Create sample employees
  const employee1 = await prisma.user.upsert({
    where: { email: 'dev1@superintech.com' },
    update: {},
    create: {
      email: 'dev1@superintech.com',
      passwordHash: hashedPassword,
      name: 'Alice Developer',
      role: UserRole.EMPLOYEE,
      departmentId: devDept.id,
      isActive: true,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: 'dev2@superintech.com' },
    update: {},
    create: {
      email: 'dev2@superintech.com',
      passwordHash: hashedPassword,
      name: 'Bob Developer',
      role: UserRole.EMPLOYEE,
      departmentId: devDept.id,
      isActive: true,
    },
  });

  console.log('✅ Sample employees created');

  // Create general chat room
  const generalChat = await prisma.chatRoom.upsert({
    where: { id: 'general-chat' },
    update: {},
    create: {
      id: 'general-chat',
      name: 'General',
      type: 'GENERAL',
      createdById: admin.id,
    },
  });

  // Add all users to general chat
  await Promise.all([
    prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId: generalChat.id, userId: admin.id } },
      update: {},
      create: { roomId: generalChat.id, userId: admin.id },
    }),
    prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId: generalChat.id, userId: manager.id } },
      update: {},
      create: { roomId: generalChat.id, userId: manager.id },
    }),
    prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId: generalChat.id, userId: employee1.id } },
      update: {},
      create: { roomId: generalChat.id, userId: employee1.id },
    }),
    prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId: generalChat.id, userId: employee2.id } },
      update: {},
      create: { roomId: generalChat.id, userId: employee2.id },
    }),
  ]);

  console.log('✅ General chat room created');

  // Create a sample project
  const project = await prisma.project.upsert({
    where: { id: 'sample-project' },
    update: {},
    create: {
      id: 'sample-project',
      name: 'Sample Project',
      description: 'A sample project to get started',
      status: 'ACTIVE',
      ownerId: manager.id,
      departmentId: devDept.id,
    },
  });

  // Add project members
  await Promise.all([
    prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: manager.id } },
      update: {},
      create: { projectId: project.id, userId: manager.id },
    }),
    prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: employee1.id } },
      update: {},
      create: { projectId: project.id, userId: employee1.id },
    }),
    prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: employee2.id } },
      update: {},
      create: { projectId: project.id, userId: employee2.id },
    }),
  ]);

  console.log('✅ Sample project created');

  // Create sample tasks
  await prisma.task.upsert({
    where: { id: 'task-1' },
    update: {},
    create: {
      id: 'task-1',
      title: 'Setup development environment',
      description: 'Install all required tools and dependencies',
      status: 'COMPLETED',
      priority: 'HIGH',
      projectId: project.id,
      reporterId: manager.id,
      assigneeId: employee1.id,
      position: 0,
    },
  });

  await prisma.task.upsert({
    where: { id: 'task-2' },
    update: {},
    create: {
      id: 'task-2',
      title: 'Create initial project structure',
      description: 'Set up the monorepo with all required packages',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      projectId: project.id,
      reporterId: manager.id,
      assigneeId: employee1.id,
      position: 1,
    },
  });

  await prisma.task.upsert({
    where: { id: 'task-3' },
    update: {},
    create: {
      id: 'task-3',
      title: 'Design database schema',
      description: 'Create Prisma schema with all required models',
      status: 'TODO',
      priority: 'MEDIUM',
      projectId: project.id,
      reporterId: manager.id,
      assigneeId: employee2.id,
      position: 2,
    },
  });

  console.log('✅ Sample tasks created');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@superintech.com / admin123');
  console.log('   Manager: manager@superintech.com / admin123');
  console.log('   Employee: dev1@superintech.com / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
