import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { v4 as uuidv4 } from 'uuid';

const fs = require('fs');
const { ObjectId } = require('mongodb');
const Bull = require('bull');

export default class FilesController {

  // Method to upload a file
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
      return res.status(400).send({ error: 'Missing data' });
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
      if (parentFile.type !== 'folder') {
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

    try {
      await fs.promises.mkdir(folderPath, { recursive: true });
      await fs.promises.writeFile(filePath, Data);
    } catch (error) {
      return res.status(400).send({ error: error.message });
    };

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

  static async getShow(req, res) {
    // Get authentication token from request header
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve file information from database
    const { id } = req.params;
    const filesCollection = dbClient.db.collection('files');
    const fileID = ObjectId(id);
    const objID = ObjectId(userId);
    // Retrieve file information from database using constants
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

  // Method to retrieve the list of files
  static async getIndex(req, res) {
    // Get authentication token from request header
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get parent ID and page number from request query
    const { parentId, page = 0 } = req.query;
    const query = { userId: ObjectId(userId) };
    if (parentId) {
      query.parentId = ObjectId(parentId);
    }

    // Retrieve the list of files from the database
    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(page * 20)
      .limit(20)
      .toArray();

    // Format the list of files
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
    // Get authentication token from request header
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve file information from database
    const filesCollection = dbClient.db.collection('files');
    const fileID = ObjectId(req.params.id);
    const userID = ObjectId(userId);

    // Retrieve file information from database using constants
    const file = await filesCollection.findOne({ _id: fileID, userId: userID });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update isPublic field to true
    const setUpdate = {
      $set: { isPublic: true, }
    };
    await filesCollection.updateOne({ _id: fileID }, setUpdate);
    // Return updated file document
    return res.status(200).json(file);
  }

  static async putUnpublish(req, res) {
    // Get authentication token from request header
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve file information from database
    const filesCollection = dbClient.db.collection('files');
    const fileID = ObjectId(req.params.id);
    const userID = ObjectId(userId);

    // Retrieve file information from database using constants
    const file = await filesCollection.findOne({ _id: fileID, userId: userID });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update isPublic field to False
    const setUpdate = {
      $set: { isPublic: false, }
    };

    await filesCollection.updateOne({ _id: fileID }, setUpdate);
    // Return updated file document
    return res.status(200).json(file);
  }

}
