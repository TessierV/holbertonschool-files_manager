import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const fs = require('fs');
const { ObjectId } = require('mongodb');
const Bull = require('bull');

export default class FilesController {
  static async postUpload(req, res) {
    const fileQueue = new Bull('fileQueue');
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!token || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    const fileType = ['folder', 'file', 'image'];
    if (!type || !fileType.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    let newFile;
    if (type === 'folder') {
      newFile = await dbClient.db.collection('files').insertOne({
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
      });
    } else {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }

      const localPath = `${folderPath}/${uuidv4()}`;
      const buff = Buffer.from(data, 'base64');
      await fs.promises.writeFile(localPath, buff);
      newFile = await dbClient.db.collection('files').insertOne({
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
        localPath,
      });

      if (type === 'image') {
        fileQueue.add({ userId, fileId: newFile.insertedId });
      }
    }

    return res.status(201).json({
      id: newFile.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const filesCollection = dbClient.db.collection('files');
    const fileID = ObjectId(id);
    const objID = ObjectId(userId);

    const file = await filesCollection.findOne({ _id: fileID, userId: objID });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId, page = 0 } = req.query;
    const query = { userId: ObjectId(userId) };
    if (parentId) {
      query.parentId = ObjectId(parentId);
    }

    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(page * 20)
      .limit(20)
      .toArray();

    const filesFormatted = files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));

    return res.status(200).json(filesFormatted);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileID = ObjectId(req.params.id);
    const userID = ObjectId(userId);

    const file = await dbClient.db.collection('files').findOne({ _id: fileID, userId: userID });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.isPublic) {
      return res.status(400).json({ error: 'File already published' });
    }

    const setUpdate = {
      $set: { isPublic: true },
    };

    const updatedFile = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: fileID, userId: userID },
      { setUpdate },
      { returnOriginal: false },
    );

    if (!updatedFile.value) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(updatedFile.value);
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileID = ObjectId(req.params.id);
    const userID = ObjectId(userId);

    const setUpdate = {
      $set: { isPublic: false },
    };

    const updatedFile = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: fileID, userId: userID },
      { setUpdate },
      { returnOriginal: false },
    );

    if (!updatedFile.value.isPublic || !updatedFile.value) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(updatedFile.value);
  }

  // ex 8
  static async getFile(req, res) {
    const { id } = req.params;
    const filesCollection = dbClient.db.collection('files');
    const query = { _id: ObjectId(id) };
    const file = await filesCollection.findOne(query);

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    const token = req.headers['x-token'];
    const tokenValue = await redisClient.get(`auth_${token}`);
    const userId = token ? tokenValue : null;
    const fileUserIdString = file.userId.toString();
    if (!file.isPublic && (!userId || userId !== fileUserIdString)) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);
    res.setHeader('Content-Type', 'text/plain' || mimeType);

    return res.status(200).sendFile(file.localPath);
  }
}
