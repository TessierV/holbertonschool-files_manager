import { createClient } from 'redis';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

class RedisClient {
  constructor() {
    // localhost:6739
    this.client = createClient();
    this.client.on('error', (error) => {
      console.log(`ERROR: ${error}`);
    });

    this.client.get = promisify(this.client.get);
    this.client.set = promisify(this.client.set);
    this.client.del = promisify(this.client.del);
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return this.client.get(key);
  }

  async set(key, value, duration) {
    await this.client.set(key, value, 'EX', duration);
  }

  async del(key) {
    await this.client.del(key);
  }

  /**
   * Returns the user ID `mongodb.ObjectID` corresponding to `auth_${userSessionToken}`,
   * from the Redis DB.
   * If something goes wrong, if the key doesn't exist in the DB,
   * or if the key has no value,
   * this method returns null.
   */
  async getUserId(userSessionToken) {
    return this.client.get(`auth_${userSessionToken}`);
  }

  /**
   * Creates user session token uuidv4,
   * and adds it to the Redis DB as `auth_${userSessionToken}`
   * as a key with `userId` as the value.
   *
   * The session token will expire in the next 24h.
   *
   * Returns { dbResponse, userSessionToken };
   */
  async makeUserSession(userId) {
    const userSessionToken = uuidv4();
    const dbResponse = await this.client.set(`auth_${userSessionToken}`, userId, 'EX', 60 * 60 * 24);

    return { dbResponse, userSessionToken };
  }

  /**
   * Attempts to delete `auth_${userSessionToken}` from the RedisDB.
   * Returns the DB's response.
   */
  async endUserSession(userSessionToken) {
    return this.client.del(`auth_${userSessionToken}`);
  }
}

const redisClient = new RedisClient();
export default redisClient;