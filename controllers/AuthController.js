import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { v4: uuidv4 } = require('uuid');

export default class AuthController {
  static async getConnect(req, res) {
    const authorization = req.header('Authorization');
    if (!authorization) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const auth = Buffer.from(authorization.replace('Basic ', ''), 'base64');
    const authentications = {
      email: auth.toString('utf-8').split(':')[0],
      password: auth.toString('utf-8').split(':')[1],
    };

    if (!authentications.email || !authentications.password) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    authentications.password = sha1(authentications.password);

    const userVerif = await dbClient.db.collection('users').findOne(authentications);
    if (!userVerif) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, userVerif._id.toString(), 86400);

    return res.status(200).send({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);
    return res.status(204).send();
  }
}
