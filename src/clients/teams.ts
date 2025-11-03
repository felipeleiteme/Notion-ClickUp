import 'dotenv/config';
import axios from 'axios';

export const teams = axios.create({
  baseURL: process.env.TEAMS_WEBHOOK_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
