import dotenv from 'dotenv';

dotenv.config();

export default {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};