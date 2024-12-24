require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

// middle where
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send("Unauthorize Access");
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send("Unauthorize Access");
    }

    req.user = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.SECRET_USER_NAME}:${process.env.SECRET_PASSWORD}@cluster0.ze0za.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();

    const serviceCollection = client.db("ServicesDB").collection("Services");
    const bookingCollection = client.db("ServicesDB").collection("Bookings");

    // jwt related apis start from here
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ status: "success" });
    });

    // clear the cookie
    app.get("/logout", async (req, res) => {
      res.clearCookie("token").send({ status: "success" });
    });

    // get all services data from database
    app.get("/services", async (req, res) => {
      const limit = parseInt(req.query.limit) || 0;
      const search = req.query.search;
      let query = { name: { $regex: search, $options: "i" } };
      if (!search) {
        query = {};
      }
      const result = await serviceCollection.find(query).limit(limit).toArray();
      res.send(result);
    });

    //get single service data from database
    app.get("/service/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    // post a service to database
    app.post("/addService", async (req, res) => {
      const newService = req.body;
      const result = await serviceCollection.insertOne(newService);
      res.send(result);
    });

    // get all services data based on who has added the service
    app.get("/services/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "provider.email": email };
      if (req.user.email !== email) {
        return res.status(403).send("Access Denied");
      }
      const result = await serviceCollection.find(query).toArray();
      res.send(result);
    });

    // udpate a service from database which you have added
    app.put("/updateService/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedService = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: updatedService.name,
          price: updatedService.price,
          description: updatedService.description,
          image: updatedService.image,
          serviceArea: updatedService.serviceArea,
        },
      };

      const result = await serviceCollection.updateOne(
        query,
        updateDoc,
        options
      );

      res.send(result);
    });

    // delete a service from database which you have added
    app.delete("/deleteService/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    // book related apis start from here
    // get all bookings data from database based o specific email & if it is a provider or not
    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const isProvider = req.query.provider;
      let query = {};
      if (isProvider) {
        query.providerEmail = email;
      } else {
        query.currentUserEmail = email;
      }

      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // post a booking to database
    app.post("/bookings", async (req, res) => {
      const newBooking = req.body;
      const result = await bookingCollection.insertOne(newBooking);
      res.send(result);
    });

    // update a booking from database
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { status } = req.body;

      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await bookingCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Learn skills project's server is running.....");
});

app.listen(port, () => {
  console.log(`my app is running on port: ${port}`);
});
