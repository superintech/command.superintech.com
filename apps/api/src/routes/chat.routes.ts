import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Room routes
router.post('/rooms', chatController.createRoom);
router.get('/rooms', chatController.getRooms);
router.get('/rooms/:id', chatController.getRoom);
router.get('/rooms/:id/messages', chatController.getMessages);
router.post('/rooms/:id/members', chatController.addMember);
router.delete('/rooms/:id/leave', chatController.leaveRoom);

// Direct message
router.get('/dm/:otherUserId', chatController.getOrCreateDM);

// Message reactions
router.post('/messages/:messageId/reactions', chatController.addReaction);

export default router;
