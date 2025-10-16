import dotenv from 'dotenv';
import {app} from './app.js'
import {connectDB} from '../src/config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const PORT = process.env.PORT || 3000;

 connectDB()
 .then(() =>{
     app.listen(PORT, () => {
       console.log(`⚙️ Server is running at port :  http://localhost:${process.env.PORT}`);
    })
})
.catch((err) => {
     console.log("MONGO db connection failed !!! ", err);
});