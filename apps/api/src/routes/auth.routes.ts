import { Router } from 'express';
import { login, logout, refresh, me, changePassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);

export default router;
