import express, { json } from 'express'; //載入express框架模組
import cors from 'cors';
import home from "./src/home.js";


let app = express();

// Middlewares
app.use(express.json());

// Routes
app.use(express.static('public'))
app.get("/", async(req, res, next) => {
    return res.status(200).json({
        title: "Express Testing",
        message: "The app is working properly!",
    });
});
// connection
const port = process.env.PORT || 9001;
app.listen(port, () => console.log(`Listening to port ${port}`));