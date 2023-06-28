const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const connectingDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is Running");
    });
  } catch (e) {
    console.log(`Error in db ${e}`);
  }
};

connectingDbAndServer();

const stateToCamelCase = (data) => {
  return {
    stateId: data.state_id,
    stateName: data.state_name,
    population: data.population,
  };
};

const districtToCamelCase = (data) => {
  return {
    districtId: data.district_id,
    districtName: data.district_name,
    stateId: data.state_id,
    cases: data.cases,
    cured: data.cured,
    active: data.active,
    deaths: data.deaths,
  };
};

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const verifyingRegisteredUserOrNot = `select * from user where username="${username}";`;
  const verifying = await db.get(verifyingRegisteredUserOrNot);
  if (verifying === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const verifyingPass = await bcrypt.compare(password, verifying.password);
    if (verifyingPass) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "abcdef");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

const authentication = (req, res, next) => {
  let jwtToken;
  const token = req.headers["authorization"];
  if (token !== undefined) {
    jwtToken = token.split(" ")[1];
  }
  if (token === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "abcdef", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states/", authentication, async (req, res) => {
  const sqlQuery = `select * from state`;
  const result = await db.all(sqlQuery);
  res.send(result.map((a) => stateToCamelCase(a)));
});

app.get("/states/:stateId/", authentication, async (req, res) => {
  const { stateId } = req.params;
  const sqlQuery = `select * from state where state_id=${stateId};`;
  const result = await db.get(sqlQuery);
  res.send(stateToCamelCase(result));
});

app.post("/districts/", authentication, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const sqlQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
                    VALUES ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const result = await db.run(sqlQuery);

  res.send("District Successfully Added");
});

app.get("/districts/:districtId/", authentication, async (req, res) => {
  const { districtId } = req.params;
  const sqlQuery = `select * from district where district_id=${districtId};`;
  const result = await db.get(sqlQuery);
  res.send(districtToCamelCase(result));
});

app.delete("/districts/:districtId/", authentication, async (req, res) => {
  const { districtId } = req.params;
  const sqlQuery = `delete from district where district_id=${districtId};`;
  const result = await db.run(sqlQuery);
  res.send("District Removed");
});

app.put("/districts/:districtId/", authentication, async (req, res) => {
  const { districtId = 322 } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const sqlQuery = `update district 
  set 
  district_name="${districtName}",
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}
  where district_id=${districtId};
  `;
  const result = await db.run(sqlQuery);

  res.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authentication, async (req, res) => {
  const { stateId } = req.params;
  const sqlQuery = `select 
  sum(cases),
  sum(cured),
  sum(active),
  sum(deaths)
  from district
  where state_id=${stateId};
  `;
  const result = await db.get(sqlQuery);
  res.send({
    totalCases: result["sum(cases)"],
    totalCured: result["sum(cured)"],
    totalActive: result["sum(active)"],
    totalDeaths: result["sum(deaths)"],
  });
});

app.get("/districts/:districtId/details/", authentication, async (req, res) => {
  const { districtId } = req.params;
  const sqlQuery = `select state_id from district where district_id = ${districtId};`;
  const result = await db.get(sqlQuery);
  const getStateNameQuery = `select state_name as stateName from state where state_id = ${result.state_id};`;
  const result2 = await db.get(getStateNameQuery);
  res.send(result2);
});

module.exports = app;
