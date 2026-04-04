const express = require("express");
const app = express();
const port = 3000;
const cors = require("cors");

app.use(express.json());
app.use(cors());
require("dotenv").config();

const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASSWORD}@cluster0.sb5wtw8.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("micro-task-earning");
    const usersCollection = db.collection("users");
    const tasksCollection = db.collection("tasks");

    // get all user data
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // register a new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // verify if email is already exist or not
    app.get("/users/verify", async (req, res) => {
      const email = req.query.email;
      if (email) {
        const existingUser = await usersCollection.findOne({ email: email });
        if (existingUser) {
          return res.status(200).send({ message: "Email already exist" });
        }
      }
    });

    // buyer add a task
    app.post("/tasks", async (req, res) => {
      const task = req.body;
      const result = await tasksCollection.insertOne(task);
      res.send(result);
    });

    // buyer get all his tasks
    app.get("/tasks", async (req, res) => {
      const email = req.query.email;
      const tasks = await tasksCollection.find({ email: email }).toArray();
      res.send(tasks);
    });

    // worker submit a task
    app.post("/tasks/submit", async (req, res) => {
      const taskInfo = req.body;
      const result = await tasksCollection.insertOne(taskInfo);
      res.send(result);
    });

    // admin update user role
    app.put("/users/role", async (req, res) => {
      const { email, role } = req.body;
      const result = await usersCollection.updateOne({ email: email }, { $set: { role: role } });
      res.send(result);
    });

    // admin delete a user
    app.delete("/users", async (req, res) => {
      const email = req.query.email;
      const result = await usersCollection.deleteOne({ email: email });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
