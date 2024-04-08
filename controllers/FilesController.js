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

    const _id = ObjectId.isValid(userId) ? new ObjectId(userId) : null; // Vérifie si userId est une chaîne ObjectId valide
    if (!_id) {
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
      try {
        newFile = await filesCollection.insertOne(newFile);
      } catch (error) {
        console.error('Error inserting folder:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

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
      try {
        newFile = await dbClient.db.collection('files').insertOne({
          userId: new ObjectId(userId),
          name,
          type,
          isPublic,
          parentId,
          localPath,
        });
      } catch (error) {
        console.error('Error inserting file:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    }

    // Return the new file.
    return res.status(201).send({
      id: newFile ? newFile.insertedId : null,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  // Method to retrieve the information of a file.
  static async getShow(req, res) {
    try {
      // Retrieve the authentication token from the req header.
      const token = req.headers['x-token'];
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized 4' });
      }

      // Retrieve the file information from the database.
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

  // Method to retrieve the list of files.
  static async getIndex(req, res) {
    try {
      // Retrieve the authentication token from the req header.
      const token = req.headers['x-token'];
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized 5' });
      }

      // Retrieve the parent ID and the page number from the req query.
      const { parentId, page = 0 } = req.query;
      const query = { userId: ObjectId(userId) };
      if (parentId) {
        query.parentId = ObjectId(parentId);
      }

      // Retrieve the list of files from the database.
      const files = await dbClient.db.collection('files')
        .find(query)
        .skip(page * 20)
        .limit(20)
        .toArray();

      // Format the list of files.
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
