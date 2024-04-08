import { ObjectId } from 'mongodb';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized 1' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized 2' });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    // Retrieve user from database
    const _id = new ObjectId(userId);
    const usersCollection = dbClient.db.collection('users');
    const user = await usersCollection.findOne({ _id });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized 3' });
    }

    const fileTypes = ['folder', 'file', 'image'];
    if (!type || !fileTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const filesCollection = dbClient.db.collection('files');
      const parentFile = await filesCollection.findOne({ _id: new ObjectId(parentId) });

      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Second part

    let newFile;
    if (type === 'folder') {
      const filesCollection = dbClient.db.collection('files');
      newFile = {
        userId: new ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
      };
      await filesCollection.insertOne(newFile);

      // Creation of the file on the server.
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

      try {
        await fs.promises.mkdir(folderPath, { recursive: true });
      } catch (error) {
        console.error('Error creating folder:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      // Write the file to the server.
      const uuid = uuidv4();
      const localPath = `${folderPath}/${uuidv4()}`;
      const buff = Buffer.from(req.body.data, 'base64');
      try {
        await fs.promises.writeFile(localPath, buff);
      } catch (error) {
        console.error('Error writing file:', error);
        return res.status(500).json({ error: 'Issue with writing file' });
      }
      newFile = await dbClient.db.collection('files').insertOne({
        userId: new ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
        localPath,
      });
    }

    // Return the new file.
    return res.status(201).send({
      id: newFile.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  // Method to retrieve the information of a file.
  static async getShow(req, res) {
    // Retrieves the authentication token from the req header.
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized 4' });
    }

    // Retrieves the file information from the database.
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
  }

  // Method to retrieve the list of files.
  static async getIndex(req, res) {
    // Retrieves the authentication token from the req header.
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized 5' });
    }

    // Retrieves the parent ID and the page number from the req query.
    const { parentId, page = 0 } = req.query;
    const query = { userId: ObjectId(userId) };
    if (parentId) {
      query.parentId = ObjectId(parentId);
    }

    // Retrieves the list of files from the database.
    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(page * 20)
      .limit(20)
      .toArray();

    // Formats the list
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
}
