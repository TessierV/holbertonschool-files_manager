import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import { promises as fsPromises } from 'fs';
import dbClient from './utils/db';

const { writeFile, readFile } = fsPromises;

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job, done) => {
  if (!job.data.fileId) {
    done(new Error('Missing fileId'));
    return;
  }

  if (!job.data.userId) {
    done(new Error('Missing userId'));
    return;
  }

  const file = await dbClient.findUserFile(job.data.userId, job.data.fileId);

  if (!file) {
    done(new Error('File not found'));
    return;
  }

  const failedSizes = [];

  for (const width of [100, 250, 500]) {
    try {
      const imageFileDataBuffer = await readFile(file.localPath);
      const thumbnail = await imageThumbnail(imageFileDataBuffer, { width });
      await writeFile(`${file.localPath}_${width}`, thumbnail);
    } catch (error) {
      console.error(error);
      failedSizes.push(width);
    }
  }

  if (failedSizes.length > 0) {
    done(new Error(`Failed to generate thumbnails for sizes: ${failedSizes.join(', ')}`));
  } else {
    done();
  }
});

export default fileQueue;
