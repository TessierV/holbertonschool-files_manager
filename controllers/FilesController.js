import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { v4 as uuidv4 } from 'uuid';

const fs = require('fs');
const { ObjectId } = require('mongodb');
const Bull = require('bull');

export default class FilesController {
  static async postUpload(req, res) {
    const fileQueue = new Bull('fileQueue');
    const token = req.header('X-token');
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const fileName = req.body.name;
    if (!fileName) {
      return res.status(400).send({ error: 'Missing name' });
    }

    const fileType = req.body.type;
    if (!fileType || !['file', 'folder', 'image'].includes(fileType)) {
      return res.status(400).send({ error: 'Missing type' });
    }

    const fileData = req.body.data;
    if (!fileData && ['file', 'image'].includes(fileType)) {
      return response.status(400).send({ error: 'Missing data' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const publicFile = req.body.isPublic || false;
    let fileParentId = req.body.parentId || 0;
    fileParentId = fileParentId === '0' ? 0 : fileParentId;

    if (fileParentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileParentId) });

      if (!parentFile) {
        return res.status(400).send({ error: 'Parent not found' });
      }
      if (!['folder'].includes(parentFile.type)) {
        return res.status(400).send({ error: 'Parent is not a folder' });
      }
    }

    const file = {
      userID: user._id,
      name: fileName,
      type: fileType,
      isPublic: publicFile,
      parentId: fileParentId,
    };

    if (['folder'].includes(fileType)) {
      await dbClient.db.collection('files').insertOne(file);
      return res.status(201).send({
        id: file._id,
	userID: file.userID,
	name: file.name,
	type: file.type,
	isPublic: file.isPublic,
	parentId: file.parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const localPathFile = uuidv4();

    const Data = Buffer.from(fileData, 'base64');
    const filePath = `${folderPath}/${localPathFile}`;

    await fs.mkdir(folderPath, { recursive: true }, (error) => {
      if (error) {
        return res.status(400).send({ error: error.message });
      }
      else {
        return true;
      }
    });

    await fs.writeFile(filePath, Data, (error) => {
      if (error) {
        return res.status(400).send({ error: error.message });
      }
      else {
        return true;
      }
    });

    file.localPath = filePath;
    await dbClient.db.collection('files').insertOne(file);

    fileQueue.add({
      userID: file.userID,
      fileID: file._id,
    });

    return res.status(201).send({
      id: file._id,
      userID: file.userID,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }
}

