import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const express = require('express');

const router = express.Router();

router.get('/status', AppController.getStatus.bind(AppController));
router.get('/stats', AppController.getStats.bind(AppController));

router.post('/users', UsersController.postNew.bind(UsersController));

router.get('/connect', AuthController.getConnect.bind(AuthController));
router.get('/disconnect', AuthController.getDisconnect.bind(AuthController));
router.get('/users/me', UsersController.getMe.bind(UsersController));

router.post('/files', FilesController.postUpload.bind(FilesController));
// 6. Get and list file
router.get('/files/:id', FilesController.getShow.bind(FilesController));
router.get('/files', FilesController.getIndex.bind(FilesController));
// 7. File publish/unpublish
router.put('/files/:id/publish', FilesController.putPublish.bind(FilesController));
router.put('/files/:id/unpublish', FilesController.putUnpublish.bind(FilesController));
// 8. getFile
router.get('/files/:id/data', FilesController.getFile.bind(FilesController));

export default router;
