const express = require('express');
const router = express.Router();

import UsersController from '../controllers/UsersController';




router.post('/users', UsersController.postNew.bind(UsersController));


router.get('/users/me', UsersController.getMe.bind(UsersController));



export default router;
