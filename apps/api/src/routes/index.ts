import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import departmentsRoutes from './departments.routes.js';
import projectsRoutes from './projects.routes.js';
import tasksRoutes from './tasks.routes.js';
import filesRoutes from './files.routes.js';
import notificationsRoutes from './notifications.routes.js';
import tagsRoutes from './tags.routes.js';
import activityRoutes from './activity.routes.js';
import chatRoutes from './chat.routes.js';
import eodrRoutes from './eodr.routes.js';
import eodrV2Routes from './eodr-v2.routes.js';
import kpiRoutes from './kpi.routes.js';
import holidayRoutes from './holiday.routes.js';
import aiRoutes from './ai.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/departments', departmentsRoutes);
router.use('/projects', projectsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/files', filesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/tags', tagsRoutes);
router.use('/activity', activityRoutes);
router.use('/chat', chatRoutes);
router.use('/eodr', eodrRoutes);
router.use('/eodr/v2', eodrV2Routes);
router.use('/kpi', kpiRoutes);
router.use('/holidays', holidayRoutes);
router.use('/ai', aiRoutes);

export default router;
