import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import fs from 'fs';

export default class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-token');
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const fileName = req.body.name;
    const fileType = req.body.type;
    const fileData = req.body.data;

    if (!fileName || !fileType || !['file', 'folder', 'image'].includes(fileType)) {
      return res.status(400).send({ error: 'Missing name or type' });
    }

    if (!fileData && ['file', 'image'].includes(fileType)) {
      return res.status(400).send({ error: 'Missing data' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    let fileParentId = req.body.parentId || 0;
    fileParentId = fileParentId === '0' ? 0 : fileParentId;

    if (fileParentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileParentId) });

      if (!parentFile || parentFile.type !== 'folder') {
        return res.status(400).send({ error: 'Invalid parent' });
      }
    }

    const file = {
      userID: user._id,
      name: fileName,
      type: fileType,
      isPublic: req.body.isPublic || false,
      parentId: fileParentId,
    };

    if (!['folder'].includes(fileType)) {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const localPathFile = uuidv4();
      const Data = Buffer.from(fileData, 'base64');
      const filePath = `${folderPath}/${localPathFile}`;

      try {
        await fs.promises.mkdir(folderPath, { recursive: true });
        await fs.promises.writeFile(filePath, Data);
      } catch (error) {
        return res.status(400).send({ error: error.message });
      }

      file.localPath = filePath;
    }

    try {
      const insertedFile = await dbClient.db.collection('files').insertOne(file);
      file._id = insertedFile.insertedId;
    } catch (error) {
      return res.status(400).send({ error: error.message });
    }

    return res.status(201).send(file);
  }
}
