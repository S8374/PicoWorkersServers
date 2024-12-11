const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;
const SSLCommerzPayment = require("sslcommerz-lts");
const jwt = require("jsonwebtoken");
// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.16q5u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const store_id = process.env.store_id;
const store_passwd = process.env.store_passwd;
const is_live = false; //true for live, false for sandbox

async function run() {
  try {
    // await client.connect();

    const userCollection = client.db("PicoWorkerDB").collection("users");
    const taskCollection = client.db("PicoWorkerDB").collection("tasks");
    const coinsCollection = client.db("PicoWorkerDB").collection("coins");
    const withDrawCollection = client.db("PicoWorkerDB").collection("withDraw");
    const paymentCollection = client.db("PicoWorkerDB").collection("payMent");

    // SSLCommerz payment gateway instance
    // const tran_id = new ObjectId().toString();

    // jwt related api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign({ email: user.email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    

    const verifyToken = (req, res, next) => {
      console.log("Authorization Header:", req.headers.authorization);
    
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
    
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.error("Token verification failed:", err);
          return res.status(401).send({ message: "Invalid token" });
        }
        console.log("Decoded Token:", decoded);
        req.decoded = decoded; // Assign decoded info
        next();
      });
    };
    

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email; // Use optional chaining
      if (!email) {
        return res.status(400).send({ message: "Invalid token data" });
      }
    
      const user = await userCollection.findOne({ email });
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
    
      next();
    };
    
    // Insert a new user
    app.post("/users", async (req, res) => {
      const newUser = req.body;

      // Check if the email already exists
      const existingUser = await userCollection.findOne({
        email: newUser.email,
      });

      if (existingUser) {
        return res.status(400).send({ message: "Email is already in use." });
      }

      // If the email does not exist, create the new user
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // Get users data
    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // Route to delete user
    app.delete("/users/:id",async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      try {
        const result = await userCollection.deleteOne(filter);

        if (result.deletedCount === 1) {
          res.status(200).send({ message: "User deleted successfully" });
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).send({ message: "Error deleting user" });
      }
    });
    // Insert a new task
    app.post("/TaskItems", async (req, res) => {
      const newTask = req.body;
      const result = await taskCollection.insertOne(newTask); // Insert into task collection
      res.send(result);
    });

    app.get("/TaskItems", async (req, res) => {
      const tasks = await taskCollection.find().toArray();
      res.send(tasks);
    });

    app.get("/TaskItems/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const task = await taskCollection.findOne({ _id: new ObjectId(id) });
        if (task) {
          res.send(task);
        } else {
          res.status(404).send({ message: "Task not found" });
        }
      } catch (error) {
        console.error("Error fetching task:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Approve a task
    app.patch("/TaskItems/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body; // Expecting status to be sent in the body

      if (!status) {
        return res.status(400).send({ message: "Status is required" });
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status, // Update status field in the task
        },
      };

      try {
        const result = await taskCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Task not found" });
        }

        res.send({ message: "Task status updated successfully", result });
      } catch (error) {
        console.error("Error updating task status:", error);
        res.status(500).send({ message: "Failed to update task status" });
      }
    });

    // Delete Task Endpoint
    app.delete("/TaskItems/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await taskCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.status(200).json({ message: "Task deleted successfully" });
        } else {
          res.status(404).json({ message: "Task not found" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete task" });
      }
    });

    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email; // Retrieve email from route parameters

      try {
        // Define the filter for the user based on email
        const filter = { email: email };

        // Update operation to increment the coins field by 10
        const updateDoc = {
          $inc: { coins: 10 },
        };

        // Perform the update operation
        const result = await userCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({
          message: "User coins increased by 10 successfully",
          result,
        });
      } catch (error) {
        console.error("Error updating user coins:", error);
        res.status(500).send({ message: "Failed to increase user coins" });
      }
    });
    //users role
    // Route to update user role to Worker
    app.patch("/users/worker/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "worker",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Route to update user role to Admin
    app.get("/users/admin/:email",async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });

      if (user) {
        res.send({ admin: user.role === "admin" });
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });
    // Route to update user role to Task Creator
    app.patch("/users/taskCreator/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "taskCreator",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.post("/coins", async (req, res) => {
      const newCoin = req.body;
      console.log("Received data for coin:", newCoin); // Log the incoming data

      try {
        const result = await coinsCollection.insertOne(newCoin);
        res.send(result);
      } catch (error) {
        console.error("Error inserting coin data:", error);
        res.status(500).send({ message: "Error inserting coin data", error });
      }
    });

    app.get("/coins", async (req, res) => {
      try {
        const coins = await coinsCollection.find().toArray();
        res.send(coins);
      } catch (error) {
        console.error("Error fetching coins:", error);
        res.status(500).send({ message: "Failed to fetch coins" });
      }
    });

    app.post("/withDraw", async (req, res) => {
      const withDraw = req.body;
      console.log("Received data for coin:", withDraw); // Log the incoming data

      try {
        // Check if the user already has a pending withdrawal
        const existingRequest = await withDrawCollection.findOne({
          userId: withDraw.userId,
          status: "pending",
        });

        if (existingRequest) {
          // Send a response indicating the request already exists
          res.send({ message: "Already added" });
          return;
        }

        // Insert the new withdrawal request
        const result = await withDrawCollection.insertOne(withDraw);
        res.send(result);
      } catch (error) {
        console.error("Error inserting coin data:", error);
        res.status(500).send({ message: "Error inserting coin data", error });
      }
    });

    app.get("/withDraw/:userId", async (req, res) => {
      const { userId } = req.params;

      try {
        const existingRequest = await withDrawCollection.findOne({
          userId: userId,
          status: "pending",
        });

        if (existingRequest) {
          res.send({ status: "pending" });
        } else {
          res.send({ status: "no pending" });
        }
      } catch (error) {
        console.error("Error checking withdrawal status:", error);
        res
          .status(500)
          .send({ message: "Error checking withdrawal status", error });
      }
    });

    app.post("/payments", async (req, res) => {
      try {
        const payment = req.body;
        const tran_id = new ObjectId().toString();

        // Check if the same user has already made a payment for this coin
        const existingPayment = await paymentCollection.findOne({
          clickedCard: payment.clickedCard,
          email: payment.email, // Include email to scope the check per user
        });

        if (existingPayment) {
          return res
            .status(400)
            .send({ error: "You have already purchased this coin." });
        }

        // Construct the payment data
        const data = {
          total_amount: payment.coinPrice,
          currency: "BDT",
          tran_id: tran_id,
          success_url: `http://localhost:3000/payment/success/${tran_id}`, // Server URL
          fail_url: "http://localhost:3000/fail",
          cancel_url: "http://localhost:3000/cancel",
          ipn_url: "http://localhost:3000/ipn",
          shipping_method: "Courier",
          product_name: payment.coinTitle,
          product_category: "Electronic",
          product_profile: "general",
          cus_name: payment.name,
          cus_email: payment.email,
          cus_add1: "Dhaka",
          cus_add2: "Dhaka",
          total_coins: payment.totalCoins,
          cus_state: "Dhaka",
          cus_time: payment.timestamp,
          cus_country: "Bangladesh",
          cus_phone: "01711111111",
          cus_fax: "01711111111",
          ship_name: "Customer Name",
          ship_add1: "Dhaka",
          ship_add2: "Dhaka",
          ship_city: "Dhaka",
          ship_state: "Dhaka",
          ship_postcode: 1000,
          ship_country: "Bangladesh",
        };

        console.log("Payment Data:", data);

        // Initialize SSLCommerz
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const apiResponse = await sslcz.init(data);

        if (apiResponse?.GatewayPageURL) {
          // Save payment details with default `paidStatus: false`
          const finallyOrder = {
            ...payment,
            paidStatus: false,
            tran_ID: tran_id,
          };

          await paymentCollection.insertOne(finallyOrder);
          res.send({ url: apiResponse.GatewayPageURL });
        } else {
          res
            .status(500)
            .send({ error: "Failed to initialize payment gateway." });
        }
      } catch (error) {
        console.error("Payment initialization error:", error);
        res.status(500).send({ error: "Payment initialization failed." });
      }
    });

    app.get("/payments",async (req, res) => {
      try {
        const payments = await paymentCollection.find().toArray();
        res.send(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).send({ message: "Failed to fetch payments" });
      }
    });

    app.get("/withDraw", async (req, res) => {
      try {
        const withdrawRequests = await withDrawCollection.find().toArray();
        res.send(withdrawRequests);
      } catch (error) {
        console.error("Error fetching withdraw requests:", error);
        res.status(500).send({ message: "Failed to fetch withdraw requests" });
      }
    });
    //
    app.post("/payment/success/:tran_id", async (req, res) => {
      try {
        const { tran_id } = req.params;
        //update coins
        const payment = await paymentCollection.findOne({ tran_ID: tran_id });

        console.log("payment", payment);
        const email = payment.email;
        const user = await userCollection.findOne({ email });
        console.log("user", user);
        const updatedCoins =
          (user.coins || 0) + parseInt(payment.totalCoins || 0);
        console.log("updatedCoins", updatedCoins);
        const userUpdateResult = await userCollection.updateOne(
          { email },
          { $set: { coins: updatedCoins } }
        );

        console.log(email);
        // Update the payment status in the database
        const result = await paymentCollection.updateOne(
          { tran_ID: tran_id },
          { $set: { paidStatus: true } }
        );
        console.log(result);
        if (result.modifiedCount > 0) {
          // Redirect to client success page
          res.redirect(`http://localhost:5173/success/${tran_id}`);
        } else {
          res
            .status(404)
            .send({ error: "Transaction ID not found or already updated." });
        }
      } catch (error) {
        console.error("Payment success error:", error);
        res.status(500).send({ error: "Payment update failed." });
      }
    });

    app.post("/payment/fail/:tran_id", async (req, res) => {
      const result = paymentCollection.deleteOne({
        tran_id: req.params.tran_id,
      });
      if (result.deletedCount > 0) {
        res.redirect(`http://localhost:5173/fail/${req.params.tran_id}`);
      } else {
        res.status(404).send({ error: "Transaction ID not found." });
      }
    });

    // Ping to confirm MongoDB connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Don't close the client
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
