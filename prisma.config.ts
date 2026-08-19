import { defineConfig } from 'prisma/define-config'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})