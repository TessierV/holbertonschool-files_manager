import { MongoClient } from 'mongodb';

// constructor that creates a client to MongoDB
class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;
    this.status = false;

    const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

    client.connect((error) => {
      if (error) {
        this.status = false;
      } else {
        this.status = true;
        this.db = client.db(database);
      }
    });
  }

  // connection to MongoDB
  isAlive() {
    return this.status;
  }

  // documents in the collection users
  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  // documents in the collection files
  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
