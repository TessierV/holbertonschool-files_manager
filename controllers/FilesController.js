import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const fs = require('fs');
const { ObjectId } = require('mongodb');
const Bull = require('bull');

export default class FilesController {
  // Handle file upload
  static async postUpload(req, res) {
    // Create a new Bull queue for file processing
    const fileQueue = new Bull('fileQueue');
    // Extract user token from request headers
    const token = req.headers['x-token'];
    // Retrieve user ID from Redis using the token
    const userId = await redisClient.get(`auth_${token}`);

    // Check if token or user ID is missing, return unauthorized error if true
    if (!token || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract necessary information from request body
    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    // Check if name is missing, return error if true
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    // Check if type is missing or invalid, return error if true
    const fileType = ['folder', 'file', 'image'];
    if (!type || !fileType.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    // Check if data is missing for file type, return error if true
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Check if parent ID exists and is a folder
    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Initialize variable to store newly created file
    let newFile;
    // If the type is 'folder', insert folder data into database
    if (type === 'folder') {
      newFile = await dbClient.db.collection('files').insertOne({
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
      });
    } else {
      // If the type is not 'folder', create file on server and insert file data into database
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

      // If the type is 'image', add file to processing queue
      if (type === 'image') {
        fileQueue.add({ userId, fileId: newFile.insertedId });
      }
    }

    // Return success response with newly created file data
    return res.status(201).json({
      id: newFile.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  // Retrieve file information by ID
  static async getShow(req, res) {
    // Extract user token from request headers
    const token = req.headers['x-token'];
    // Retrieve user ID from Redis using the token
    const userId = await redisClient.get(`auth_${token}`);

    // Check if user ID is missing, return unauthorized error if true
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract file ID from request parameters
    const { id } = req.params;
    const filesCollection = dbClient.db.collection('files');
    const fileID = ObjectId(id);
    const objID = ObjectId(userId);

    // Find file in database by ID and user ID
    const file = await filesCollection.findOne({ _id: fileID, userId: objID });

    // Return error if file is not found
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Return file information if found
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  // Retrieve files based on user ID and optional parent ID and pagination
  static async getIndex(req, res) {
    // Extract user token from request headers
    const token = req.headers['x-token'];
    // Retrieve user ID from Redis using the token
    const userId = await redisClient.get(`auth_${token}`);
    // Check if user ID is missing, return unauthorized error if true
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract parent ID and page number from query parameters
    const { parentId, page = 0 } = req.query;
    const query = { userId: ObjectId(userId) };
    if (parentId) {
      query.parentId = ObjectId(parentId);
    }

    // Retrieve files from database based on query and pagination
    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(page * 20)
      .limit(20)
      .toArray();

    // Format retrieved files and return as JSON response
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

  // Update file visibility to public
  static async putPublish(req, res) {
    return FilesController.updateFileVisibility(req, res, true);
  }

  // Update file visibility to private
  static async putUnpublish(req, res) {
    return FilesController.updateFileVisibility(req, res, false);
  }

  // Common method to update file visibility
  static async updateFileVisibility(req, res, isPublic) {
    // Extract user token from request headers
    const token = req.headers['x-token'];
    // Check if token is missing, return unauthorized error if true
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Retrieve user ID from Redis using the token
    const userId = await redisClient.get(`auth_${token}`);
    // Check if user ID is missing, return unauthorized error if true
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const _id = new ObjectId(userId);
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id });
    // Check if user is not found, return unauthorized error
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract file ID from request parameters
    const fileId = ObjectId(req.params.id);
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({ _id: fileId });
    // Check if file is not found or user does not own the file, return not found error
    if (!file || user._id.toString() !== file.userId.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update file visibility in the database
    const update = {
      $set: {
        isPublic,
      },
    };

    await filesCollection.updateOne({ _id: fileId }, update);

    // Retrieve updated file from the database and format response
    const fileUpdated = await filesCollection.findOne({ _id: fileId });
    fileUpdated.id = fileUpdated._id;
    delete fileUpdated._id;
    return res.json(fileUpdated);
  }

  // Retrieve file content by ID
  static async getFile(req, res) {
    const { id } = req.params;
    const filesCollection = dbClient.db.collection('files');
    const query = { _id: ObjectId(id) };
    const file = await filesCollection.findOne(query);

    // Return not found error if file is not found
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Extract user token from request headers
    const token = req.headers['x-token'];
    // Retrieve user ID from Redis using the token
    const tokenValue = await redisClient.get(`auth_${token}`);
    const userId = token ? tokenValue : null;
    const fileUserIdString = file.userId.toString();
    // Check if file is not public and user is not authorized, return not found error
    if (!file.isPublic && (!userId || userId !== fileUserIdString)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Return error if file type is 'folder'
    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    // Return not found error if file path does not exist
    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Set content type header based on file type
    const mimeType = mime.lookup(file.name);
    res.setHeader('Content-Type', 'text/plain' || mimeType);

    // Send file content as response
    return res.status(200).sendFile(file.localPath);
  }
}
