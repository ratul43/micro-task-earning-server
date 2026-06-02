const express = require("express");
const app = express();
const port = 3000;
const cors = require("cors");

app.use(express.json());
app.use(cors());
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    const notificationsCollection = db.collection("notifications");
    const earningsCollection = db.collection("earnings");
    const paymentsCollection = db.collection("payments");

    // get all user data
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get only one user data by email
    app.get("/users/email", async (req, res) => {
      const email = req.query.email;
      const user = await usersCollection.findOne({ email: email });
      res.send(user);
    });

    // register a new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // verify if email is already exist or not
    // Backend - verify email endpoint
    app.get("/users/verify", async (req, res) => {
      const { email } = req.query;

      const user = await usersCollection.findOne({ email });

      if (user) {
        return res.send({ message: "Email already exists" });
      } else {
        return res.send({ message: "Email is available" });
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

    // get all tasks for worker
    app.get("/allTasks", async (req, res) => {
      const tasks = await tasksCollection.find().toArray();
      res.send(tasks);
    });

    // buyer get all his tasks
    app.get("/tasks", async (req, res) => {
      const email = req.query.email;
      const tasks = await tasksCollection
        .find({ buyer_email: email })
        .toArray();
      res.send(tasks);
    });

    // sum of all worker needed for tasks by buyer
    app.get("/tasks/worker-count", async (req, res) => {
      const email = req.query.email;
      const tasks = await tasksCollection
        .find({ buyer_email: email })
        .toArray();

      // const count = tasks[0].required_workers

      const totalWorkerNeeded = tasks.reduce(
        (sum, task) => sum + task.required_workers,
        0,
      );
      res.send({ totalWorkerNeeded });
    });

    // buyer get all added tasks count
    app.get("/tasks/count", async (req, res) => {
      const email = req.query.email;
      const count = await tasksCollection.countDocuments({
        buyer_email: email,
      });
      res.send({ count });
    });

    // task details by id
    app.get("/tasks/details", async (req, res) => {
      const id = req.query.id;
      const task = await tasksCollection.findOne({ _id: new ObjectId(id) });
      res.send(task);
    });

    // worker submit a task
    app.post("/tasks/submit", async (req, res) => {
      const taskInfo = req.body;
      const result = await workerSubmissionsCollection.insertOne(taskInfo);

      // create notification for the buyer about new submission
      try {
        if (taskInfo.buyer_email) {
          const notif = {
            message: `You have a new submission for ${taskInfo.task_title} by ${taskInfo.worker_name}`,
            toEmail: taskInfo.buyer_email,
            actionRoute: "/dashboard/submissions-review",
            time: new Date(),
            read: false,
          };
          await notificationsCollection.insertOne(notif);
        }
      } catch (err) {
        console.error("Failed to create submission notification:", err);
      }

      if (taskInfo.task_id) {
        try {
          await tasksCollection.updateOne(
            {
              _id: new ObjectId(taskInfo.task_id),
              required_workers: { $gt: 0 },
            },
            { $inc: { required_workers: -1 } },
          );
        } catch (error) {
          console.error("Failed to decrement required_workers:", error);
        }
      }

      res.send(result);
    });

    // worker submitted task list by worker email count
    app.get("/tasks/submit/count", async (req, res) => {
      const email = req.query.email;
      const count = await workerSubmissionsCollection.countDocuments({
        worker_email: email,
      });
      res.send({ count });
    });

    // reject a submitted task by buyer (mark rejected and increment required_workers)
    app.put("/tasks/submit/reject/:id", async (req, res) => {
      try {
        const submitId = req.params.id;

        const submission = await workerSubmissionsCollection.findOne({
          _id: new ObjectId(submitId),
        });

        if (!submission) {
          return res.status(404).send({ error: "Submission not found" });
        }

        // Mark submission as rejected
        await workerSubmissionsCollection.updateOne(
          { _id: new ObjectId(submitId) },
          { $set: { status: "rejected" } },
        );

        // notify worker about rejection
        try {
          const notif = {
            message: `Your submission for ${submission.task_title} was rejected by ${submission.buyer_name}`,
            toEmail: submission.worker_email,
            actionRoute: "/dashboard/submissions",
            time: new Date(),
            read: false,
          };
          await notificationsCollection.insertOne(notif);
        } catch (err) {
          console.error("Failed to create rejection notification:", err);
        }

        // Increment required_workers back on the parent task
        if (submission.task_id) {
          try {
            await tasksCollection.updateOne(
              { _id: new ObjectId(submission.task_id) },
              { $inc: { required_workers: 1 } },
            );
          } catch (err) {
            console.error("Failed to increment required_workers:", err);
          }
        }

        res.send({ success: true });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // worker submitted task list by status count
    app.get("/tasks/submit/status-count", async (req, res) => {
      const email = req.query.email;
      const pendingCount = await workerSubmissionsCollection.countDocuments({
        worker_email: email,
        status: "pending",
      });
      // const approvedCount = await workerSubmissionsCollection.countDocuments({ worker_email: email, status: "approved" });
      // const rejectedCount = await workerSubmissionsCollection.countDocuments({ worker_email: email, status: "rejected" });
      res.send({ pendingCount });
    });

    // worker submitted task list (optionally filter by worker email via ?email=<worker_email>)
    // Supports pagination via ?page=<number>&limit=<number>
    app.get("/tasks/submit", async (req, res) => {
      try {
        const email = req.query.email;
        const page = Math.max(1, parseInt(req.query.page)) || 1;
        const limit = Math.max(1, parseInt(req.query.limit)) || 10;
        const filter = email ? { worker_email: email } : {};

        const total = await workerSubmissionsCollection.countDocuments(filter);
        const totalPages = Math.ceil(total / limit) || 1;
        const skip = (page - 1) * limit;

        const submissions = await workerSubmissionsCollection
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        res.send({ submissions, total, page, totalPages, limit });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // worker earning after approval
    app.get("/earnings", async (req, res) => {
      const email = req.query.email;
      const earnings = await earningsCollection
        .find({ worker_email: email })
        .toArray();
      res.send(earnings);
    });

    // Calculate total earning for a worker after task approval and save it in the database
    app.put("/tasks/submit/review/:id", async (req, res) => {
      const submitId = req.params.id;

      // Find the submission
      const submission = await workerSubmissionsCollection.findOne({
        _id: new ObjectId(submitId),
      });

      if (!submission) {
        return res.status(404).send({ error: "Submission not found" });
      }

      // Convert payable amount to a number and approve the submission
      const payableAmount = Number(submission.payable_amount) || 0;
      await workerSubmissionsCollection.updateOne(
        { _id: new ObjectId(submitId) },
        { $set: { status: "approved", payable_amount: payableAmount } },
      );

      // notify worker about approval and earning
      try {
        const notif = {
          message: `you have earned ${payableAmount} from ${submission.buyer_name} for completing ${submission.task_title}`,
          toEmail: submission.worker_email,
          actionRoute: "/dashboard",
          time: new Date(),
          read: false,
        };
        await notificationsCollection.insertOne(notif);
      } catch (err) {
        console.error("Failed to create approval notification:", err);
      }

      // Calculate total earning = sum of all approved submissions for this worker
      const aggregation = await workerSubmissionsCollection
        .aggregate([
          {
            $match: {
              worker_email: submission.worker_email,
              status: "approved",
            },
          },
          { $group: { _id: null, total: { $sum: "$payable_amount" } } },
        ])
        .toArray();

      const totalEarning = aggregation.length > 0 ? aggregation[0].total : 0;

      // Save the total earning back into the worker’s submissions (or worker profile if you have one)
      await workerSubmissionsCollection.updateMany(
        { worker_email: submission.worker_email },
        { $set: { total_earning: totalEarning } },
      );

      res.send({ success: true, totalEarning });
    });

    // fetch submission info by id and return worker_email/payable amount
    app.put("/tasks/submit", async (req, res) => {
      const { id } = req.body;
      if (!id) {
        return res.status(400).send({ error: "Submission id is required." });
      }

      const submission = await workerSubmissionsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!submission) {
        return res.status(404).send({ error: "Submission not found." });
      }

      res.send({
        worker_email: submission.worker_email,
        payable_amount: Number(submission.payable_amount) || 0,
      });
    });

    // worker get total earning
    app.get("/total-earning", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res
          .status(400)
          .send({ error: "Email query parameter is required." });
      }

      const aggregation = await workerSubmissionsCollection
        .aggregate([
          { $match: { worker_email: email, status: "approved" } },
          { $group: { _id: null, total: { $sum: "$payable_amount" } } },
        ])
        .toArray();

      const totalEarning = aggregation.length > 0 ? aggregation[0].total : 0;
      res.send({ totalEarning });
    });

    // worker withdrawal request
    app.post("/withdrawal", async (req, res) => {
      const withdrawalInfo = req.body;
      const result = await withdrawalsCollection.insertOne(withdrawalInfo);
      res.send(result);
    });

    // worker withdrawal request
    app.get("/withdrawal", async (req, res) => {
      const result = await withdrawalsCollection.find({}).toArray();
      res.send(result);
    });

    // admin update withdrawal status
    app.put("/withdrawal/:id", async (req, res) => {
      try {
        const withdrawalId = req.params.id;
        const { status } = req.body;
        // find withdrawal to notify user if needed
        const withdrawalDoc = await withdrawalsCollection.findOne({
          _id: new ObjectId(withdrawalId),
        });

        const result = await withdrawalsCollection.updateOne(
          { _id: new ObjectId(withdrawalId) },
          { $set: { status } },
        );

        if (
          result.modifiedCount > 0 &&
          status === "approved" &&
          withdrawalDoc
        ) {
          try {
            const notif = {
              message: `Your withdrawal request of ${withdrawalDoc.withdrawal_amount} dollar has been approved`,
              toEmail: withdrawalDoc.worker_email,
              actionRoute: "/dashboard/my-withdraw-requests",
              time: new Date(),
              read: false,
            };
            await notificationsCollection.insertOne(notif);
          } catch (err) {
            console.error(
              "Failed to create withdrawal approval notification:",
              err,
            );
          }
        }

        res.send({ success: true, modifiedCount: result.modifiedCount });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // get notifications for a user by email (sorted desc)
    app.get("/notifications", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email)
          return res
            .status(400)
            .send({ error: "Email query parameter is required." });
        const notifs = await notificationsCollection
          .find({ toEmail: email })
          .sort({ time: -1 })
          .toArray();
        res.send(notifs);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // mark a notification as read by id
    app.put("/notifications/:id/read", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await notificationsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { read: true } },
        );
        if (result.modifiedCount === 0) {
          return res.status(404).send({ error: "Notification not found." });
        }
        res.send({ success: true });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // mark all notifications as read for a user
    app.put("/notifications/read-all", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email)
          return res
            .status(400)
            .send({ error: "Email is required." });
        const result = await notificationsCollection.updateMany(
          { toEmail: email, read: { $ne: true } },
          { $set: { read: true } },
        );
        res.send({ success: true, modifiedCount: result.modifiedCount });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // admin update user role
    app.put("/users/:id/role", async (req, res) => {
      const userId = req.params.id;
      const { role } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { role: role } },
      );
      res.send(result);
    });

    // update user coins by email
    app.put("/users", async (req, res) => {
      try {
        const { email, coins } = req.body;
        if (!email || typeof coins !== "number") {
          return res
            .status(400)
            .send({ error: "Email and numeric coins are required." });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ error: "User not found." });
        }

        const updatedCoins = (Number(user.coins) || 0) + coins;
        await usersCollection.updateOne(
          { email },
          { $set: { coins: updatedCoins } },
        );

        res.send({ success: true, coins: updatedCoins });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
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
      const { id } = req.query;
      const result = await tasksCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.send(result);
    });

    // delete or reject a submitted task by buyer
    app.delete("/tasks/submit", async (req, res) => {
      const taskId = req.query.id;
      const result = await workerSubmissionsCollection.deleteOne({
        _id: new ObjectId(taskId),
      });
      res.send(result);
    });

    // get only approved tasks for worker
    app.get("/tasks/approved", async (req, res) => {
      const approvedTasks = await workerSubmissionsCollection
        .find({ status: "approved" })
        .toArray();
      res.send(approvedTasks);
    });

    // stripe payment intent creation
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { amount, currency } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
          automatic_payment_methods: { enabled: true },
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    app.post("/create-checkout-session", async (req, res) => {
      try {
        const { amount, currency, coins, success_url, cancel_url } = req.body;

        if (!amount || !currency || !coins || !success_url || !cancel_url) {
          return res
            .status(400)
            .send({ error: "Missing required checkout session fields." });
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency,
                product_data: {
                  name: `${coins} coins purchase`,
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          metadata: {
            coins: String(coins),
          },
          success_url,
          cancel_url,
        });

        res.json({ url: session.url });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    app.post("/payments/complete", async (req, res) => {
      try {
        const { sessionId, email } = req.body;

        if (!sessionId || !email) {
          return res
            .status(400)
            .send({ error: "sessionId and email are required." });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["payment_intent"],
        });

        if (!session) {
          return res.status(404).send({ error: "Stripe session not found." });
        }

        if (session.payment_status !== "paid") {
          return res.status(400).send({ error: "Payment not completed." });
        }

        const coins = Number(session.metadata?.coins || 0);
        const amount = Number(session.amount_total || 0) / 100;
        const currency = session.currency;
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        if (!coins || !paymentIntentId) {
          return res
            .status(400)
            .send({ error: "Payment session is missing required metadata." });
        }

        const existingPayment = await paymentsCollection.findOne({
          paymentIntentId,
        });
        if (existingPayment) {
          const user = await usersCollection.findOne({ email });
          return res.send({
            success: true,
            coins: Number(user?.coins || 0),
            alreadyProcessed: true,
          });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ error: "User not found." });
        }

        const currentCoins = Number(user.coins) || 0;
        const updatedCoins = currentCoins + coins;

        await usersCollection.updateOne(
          { email },
          { $set: { coins: updatedCoins } },
        );

        await paymentsCollection.insertOne({
          email,
          coins,
          amount,
          currency,
          paymentIntentId,
          status: "completed",
          timestamp: new Date().toISOString(),
          createdAt: new Date(),
        });

        res.send({ success: true, coins: updatedCoins });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    app.patch("/users/coins", async (req, res) => {
      try {
        const { email, coins } = req.body;
        if (!email || typeof coins !== "number") {
          return res
            .status(400)
            .send({ error: "Email and numeric coins are required." });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ error: "User not found." });
        }

        const currentCoins = Number(user.coins) || 0;
        const updatedCoins = currentCoins + coins;

        await usersCollection.updateOne(
          { email },
          { $set: { coins: updatedCoins } },
        );

        res.send({ success: true, coins: updatedCoins });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Save payment transaction
    app.post("/payments", async (req, res) => {
      try {
        const {
          email,
          coins,
          amount,
          currency,
          paymentIntentId,
          status,
          timestamp,
        } = req.body;

        if (!email || !coins || !amount || !currency) {
          return res
            .status(400)
            .send({ error: "Missing required payment fields." });
        }

        const paymentData = {
          email,
          coins,
          amount,
          currency,
          paymentIntentId,
          status: status || "completed",
          timestamp: timestamp || new Date().toISOString(),
          createdAt: new Date(),
        };

        const result = await paymentsCollection.insertOne(paymentData);
        res.send({ success: true, paymentId: result.insertedId });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Get payment history (optionally filtered by email)
    app.get("/payments", async (req, res) => {
      try {
        const { email } = req.query;
        const filter = email ? { email } : {};
        const payments = await paymentsCollection
          .find(filter)
          .sort({ timestamp: -1 })
          .toArray();
        res.send(payments);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
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
