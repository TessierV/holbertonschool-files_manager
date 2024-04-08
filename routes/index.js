const express = require('express');
const router = express.Router();
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';


router.get('/status', AppController.getStatus.bind(AppController))
router.get('/stats', AppController.getStats.bind(AppController));

router.post('/users', UsersController.postNew.bind(UsersController));

router.get('/connect', AuthController.getConnect.bind(AuthController));
router.get('/disconnect', AuthController.getDisconnect.bind(AuthController));
router.get('/users/me', UsersController.getMe.bind(UsersController));

router.post('/files', FilesController.postUpload.bind(FilesController));


export default router;
