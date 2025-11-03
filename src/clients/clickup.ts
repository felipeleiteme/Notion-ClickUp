import 'dotenv/config';
import axios from 'axios';

export const clickup = axios.create({
  baseURL: 'https://api.clickup.com/api/v2/',
  headers: {
    Authorization: process.env.CLICKUP_API_TOKEN as string,
  },
});
