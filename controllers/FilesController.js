import { ObjectId } from 'mongodb';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class FilesController {
  static async postUpload(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Token missing' });
      }

      // Verify user authentication using token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }

      const { name, type, parentId = 0, isPublic = false, data } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Bad Request: Missing name' });
      }

      const _id = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
      if (!_id) {
        return res.status(401).json({ error: 'Unauthorized: Invalid user ID' });
      }

      const fileTypes = ['folder', 'file', 'image'];
      if (!type || !fileTypes.includes(type)) {
        return res.status(400).json({ error: 'Bad Request: Invalid file type' });
      }

      if (!data && type !== 'folder') {
        return res.status(400).json({ error: 'Bad Request: Missing data' });
      }

      if (parentId !== 0) {
        const filesCollection = dbClient.db.collection('files');
        const parentFile = await filesCollection.findOne({ _id: new ObjectId(parentId) });

        if (!parentFile) {
          return res.status(400).json({ error: 'Bad Request: Parent not found' });
        }

        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Bad Request: Parent is not a folder' });
        }
      }

      let newFile;
      if (type === 'folder') {
        // Insert new folder into database
        newFile = await dbClient.db.collection('files').insertOne({
          userId: new ObjectId(userId),
          name,
          type,
          isPublic,
          parentId,
        });

        // Create the folder on the server
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
        await fs.mkdir(folderPath, { recursive: true });

        return res.status(201).json({
          id: newFile.insertedId,
          userId,
          name,
          type,
          isPublic,
          parentId,
        });
      } else {
        // Write the file to the server
        const uuid = uuidv4();
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
        const localPath = `${folderPath}/${uuid}`;
        const buff = Buffer.from(data, 'base64');
        await fs.writeFile(localPath, buff);

        // Insert new file into database
        newFile = await dbClient.db.collection('files').insertOne({
          userId: new ObjectId(userId),
          name,
          type,
          isPublic,
          parentId,
          localPath,
        });

        return res.status(201).json({
          id: newFile.insertedId,
          userId,
          name,
          type,
          isPublic,
          parentId,
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Method to retrieve information of a file
  static async getShow(req, res) {
    try {
      // Get authentication token from request header
      const token = req.headers['x-token'];
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }

      // Retrieve file information from database
      const { id } = req.params;
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
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
    } catch (error) {
      console.error('Error retrieving file:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Method to retrieve the list of files
  static async getIndex(req, res) {
    try {
      // Get authentication token from request header
      const token = req.headers['x-token'];
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
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
    } catch (error) {
      console.error('Error retrieving files:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
