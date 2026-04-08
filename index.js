const express = require("express");
const app = express();
const port = 3000;
const cors = require("cors");

app.use(express.json());
app.use(cors());
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    const workerSubmissionsCollection = db.collection("workerSubmissions");
    const withdrawalsCollection = db.collection("withdrawals");

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
      const finalTaskData = {
        ...task,
        id: new ObjectId(),
        status: "pending",
        created_at: new Date(),
      };
      const result = await tasksCollection.insertOne(finalTaskData);
      res.send(result);
    });

    // buyer get all his tasks
    app.get("/tasks", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const tasks = await tasksCollection
        .find({ buyer_email: email })
        .toArray();
      res.send(tasks);
    });

    // worker submit a task
    app.post("/tasks/submit", async (req, res) => {
      const taskInfo = req.body;
      const result = await workerSubmissionsCollection.insertOne(taskInfo);
      res.send(result);
    });

    // worker submitted task list
    app.get("/tasks/submit", async (req, res) => {
      const email = req.query.email;
      const submissions = await workerSubmissionsCollection
        .find({ worker_email: email })
        .toArray();
      res.send(submissions);
    });

    // worker withdrawal request
    app.post("/withdrawal", async (req, res) => {
      const withdrawalInfo = req.body;
      const result = await withdrawalsCollection.insertOne(withdrawalInfo);
      res.send(result);
    });

    // admin update user role
    app.put("/users/role", async (req, res) => {
      const { email, role } = req.body;
      const result = await usersCollection.updateOne(
        { email: email },
        { $set: { role: role } },
      );
      res.send(result);
    });

    // admin delete a user
    app.delete("/users", async (req, res) => {
      const email = req.query.email;
      const result = await usersCollection.deleteOne({ email: email });
      res.send(result);
    });

    // admin delete a task
    app.delete("/tasks", async (req, res) => {
      const taskId = req.query.id;
      const result = await tasksCollection.deleteOne({
        _id: new ObjectId(taskId),
      });
      res.send(result);
    });

    // update buyer added tasks
    app.put("/tasks", async (req, res) => {
      const updatedData = req.body;
      const {id} = req.query;
      const result = await tasksCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
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
