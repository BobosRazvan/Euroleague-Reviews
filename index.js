import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import crypto from "crypto"; // Import the crypto module
import session from "express-session";

const app = express();
const port = 3000;

let UsersIdCount = 4;
let currentUser;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "euroleague",
  password: "123456",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.use(session({
  secret: 'partizan', // Change this to a secure key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }, // Set secure to true in a production environment with HTTPS
}));


app.get("/", function (req, res) {
  res.render("index.ejs");
});

app.get("/login", function (req, res) {
  res.render("login.ejs");
});

app.get("/register", function (req, res) {
  res.render("register.ejs");
});

app.get("/home", function (req, res) {
  res.render("home.ejs");
});
app.post("/register", async function (req, res) {
  const email = req.body.username;
  const plaintextPassword = req.body.password;

  try {
    // Check if the user with the given email already exists
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (existingUser.rows.length > 0) {
      // User with the same email already exists, throw an error
      res.status(400).send("User with this email already exists.");
    } else {
      // Hash the password
      const hashedPassword = crypto.createHash("md5").update(plaintextPassword).digest("hex");

      // Insert the new user without specifying the id column
      const result = await db.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *;",
        [email, hashedPassword]
      );

      if (result.rows.length > 0) {
        // Set the user in the session after successful registration
        req.session.user = {
          id: result.rows[0].id,
          email: result.rows[0].email,
        };

        res.render("home.ejs");
      } else {
        // Handle the case where the insertion failed
        res.status(500).send("Failed to register the user.");
      }
    }
  } catch (err) {
    console.error(err);
    // Handle other errors appropriately
    res.status(500).send("Internal Server Error");
  }
});


app.post("/login", async function (req, res) {
  const username = req.body.username;
  const plaintextPassword = req.body.password;

  try {
    const data1 = await db.query("SELECT id, email, password FROM users WHERE email = $1", [username]);
    const foundUser = data1.rows[0];

    if (foundUser) {
      const hashedPassword = crypto.createHash("md5").update(plaintextPassword).digest("hex");

      if (foundUser.password === hashedPassword) {
        // Set the user in the session
        req.session.user = {
          id: foundUser.id,
          email: foundUser.email,
        };

        res.render("home.ejs");
      } else {
        res.render("login.ejs");
      }
    } else {
      res.render("login.ejs");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/home", function (req, res) {
  res.render("home.ejs");
});

app.get("/games", function (req, res) {
  res.render("game.ejs");
});

app.get("/standings", function (req, res) {
  res.render("standings.ejs");
});

app.get("/gamereview", function (req, res) {
  res.render("gamereview.ejs");
});

app.post("/gamereview", async function (req, res) {
  try {
    const gameID = req.body.name;

    const gameData = await db.query(`
      SELECT r.rating, r.comments, u.email
      FROM reviews r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.game_id = $1
    `, [gameID]);

    if (gameData.rowCount === 0) {
      res.render("gamereview2.ejs");
      
      return;
    }

    res.render("gamereview.ejs", {
      gameData: gameData.rows, 
    });

  } catch (error) {
    console.error("Error fetching game review:", error);
    res.status(500).send("Internal Server Error");
  }
});




app.get("/submitgamereview",function(req,res)
{
    res.render("submitgamereview.ejs");
});


app.post("/submitgamereview", async function (req, res) {
  const submittedRating = req.body.rating;
  const submittedComments = req.body.comments;
  const submittedMatchNumber = req.body.matchNumber;
  const currentUser = req.session.user;

  console.log(submittedMatchNumber);

  try {
    const result = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [currentUser.email]
    );

    if (result.rows.length > 0) {
      const userID = result.rows[0].id;

      // Use the submitted values in your database query
      res.render("game.ejs");

      await db.query(
        "INSERT INTO reviews (rating, comments, user_id, game_id) VALUES ($1, $2, $3, $4)",
        [submittedRating, submittedComments, userID, submittedMatchNumber]
      );
    } else {
      console.log("User ID not found");
    }
  } catch (error) {
    console.error("Error fetching user ID:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/teams", function (req, res) {
  res.render("teams.ejs");
});


app.get("/roster", function (req, res) {
  res.render("roster.ejs");
});


app.post("/roster", async function (req, res) {
  const teamName=req.body.teamName;
  const first_NamePlayers=await db.query(
    "SELECT first_name FROM PLAYER WHERE team_name=$1",
    [teamName]
  );
  console.log(first_NamePlayers);
  const last_NamePlayers=await db.query(
    "SELECT last_name FROM PLAYER WHERE team_name=$1",
    [teamName]
  );

  const coach_name=await db.query(
    "select c.first_name,c.last_name from coach c join teams t on t.id=c.team_id where t.name=$1",
    [teamName]
  );

 

  res.render("roster.ejs",{
    teamName: teamName,
    firstName: first_NamePlayers,
    lastName: last_NamePlayers,
    coachName: coach_name
  });
});


app.get("/review-team", function (req, res) {
  res.render("teamreview.ejs");
});

app.post("/review-team", async function (req, res) {
  try {
    const teamName = req.body.teamName;
    

    const teamIDResult = await db.query(`
      SELECT id
      FROM teams
      WHERE name = $1
    `, [teamName]);

    // Extract the teamID from the result
    const teamID = teamIDResult.rows[0]?.id;
  
    if (!teamID) {
      res.render("teamreview2.ejs",{
        teamName: teamName
      });
      return;
    }

    const teamData = await db.query(`
      SELECT r.rating, r.comments, u.email
      FROM reviews r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.team_id = $1
    `, [teamID]);
  
    if (teamData.rowCount === 0) {
      res.render("teamreview2.ejs",{
        teamName: teamName
      });
      return;
    }

    res.render("teamreview.ejs", {
      teamName: teamName,
      teamData: teamData.rows,
    });

  } catch (error) {
    console.error("Error fetching team review:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/submitteamreview1",function(req,res)
{
    res.render("submitteamreview.ejs");
});


app.post("/submitteamreview1",function(req,res)
{
  const submittedTeamName = req.body.teamName;

    res.render("submitteamreview.ejs",{
      teamName: submittedTeamName
    });
});




app.post("/submitteamreview2", async function (req, res) {
  const submittedRating = req.body.rating;
  const submittedComments = req.body.comments;
  const submittedTeamName = req.body.teamName;
  const currentUser = req.session.user;

  try {
    const result = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [currentUser.email]
    );

    const teamIDResult = await db.query(`
      SELECT id
      FROM teams
      WHERE name = $1
    `, [submittedTeamName]);

    if (result.rows.length > 0) {
      const userID = result.rows[0].id;
      const teamID = teamIDResult.rows[0].id;

      await db.query(
        "INSERT INTO reviews (rating, comments, user_id, team_id) VALUES ($1, $2, $3, $4)",
        [submittedRating, submittedComments, userID, teamID]
      );

      res.render("teams.ejs");
    } else {
      console.log("User ID not found");
    }
  } catch (error) {
    console.error("Error fetching user ID:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/review-player", function (req, res) {
  res.render("playerreview.ejs");
});

app.post("/review-player", async function (req, res) {
  try {
    const playerName = req.body.playerName;

    // Split the full name into first and last names
    const [firstName, lastName] = playerName.split(" ");

    const playerIDResult = db.query(`
      SELECT id
      FROM player
      WHERE first_name = $1 AND last_name = $2
    `, [firstName, lastName]);

    const playerAttributesResult = db.query(`
      SELECT team_name, role, nationality, height, birthyear
      FROM player
      WHERE first_name = $1 AND last_name = $2
    `, [firstName, lastName]);

    // Extract the playerID from the result
    const playerID = (await playerIDResult).rows[0]?.id;

    const playerStatsResult = db.query(`
      SELECT points, rebounds, assists
      FROM stats
      WHERE player_id=$1
    `, [playerID]);

    const playerDataResult = db.query(`
      SELECT r.rating, r.comments, u.email
      FROM reviews r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.player_id = $1
    `, [playerID]);

    const [playerAttributes, playerStats, playerData] = await Promise.all([
      playerAttributesResult,
      playerStatsResult,
      playerDataResult,
    ]);

    if (!playerID) {
      res.render("playerreview2.ejs", {
        playerName: playerName
      });
      return;
    }

    res.render("playerreview.ejs", {
      playerName: playerName,
      playerData: playerData.rows,
      playerStats: playerStats.rows,
      playerAttributes: playerAttributes.rows,
    });

  } catch (error) {
    console.error("Error fetching player review:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/submitplayerreview1",function(req,res)
{
    res.render("submitteamreview.ejs");
});


app.post("/submitplayerreview1",function(req,res)
{
  const submittedPlayerName = req.body.playerName;

    res.render("submitplayerreview.ejs",{
      playerName: submittedPlayerName
    });
});



app.post("/submitplayerreview2", async function (req, res) {
  const submittedRating = req.body.rating;
  const submittedComments = req.body.comments;
  const submittedPlayerName = req.body.playerName;
  const currentUser = req.session.user;
  console.log(currentUser);

  try {
    const result = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [currentUser.email]
    );

    console.log(result);

    if (result.rows.length > 0) {
      const userID = result.rows[0]?.id;

      if (!userID) {
        console.log("User ID not found");
        res.status(404).send("User not found");
        return;
      }

      // Split the full name into first and last names
      const [firstName, lastName] = submittedPlayerName.split(" ");

      const playerIDResult = await db.query(`
        SELECT id
        FROM player
        WHERE first_name = $1 AND last_name = $2
      `, [firstName, lastName]);

      console.log(playerIDResult);

      if (playerIDResult.rows.length > 0) {
        const playerID = playerIDResult.rows[0].id;

        await db.query(
          "INSERT INTO reviews (rating, comments, user_id, player_id) VALUES ($1, $2, $3, $4)",
          [submittedRating, submittedComments, userID, playerID]
        );

        res.render("teams.ejs");
      } else {
        console.log("Player ID not found");
        res.status(404).send("Player not found");
      }
    } else {
      console.log("User ID not found");
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error fetching user ID:", error);
    res.status(500).send("Internal Server Error");
  }
});



app.get("/review-coach", function (req, res) {
  res.render("coachreview.ejs");
});

app.post("/review-coach", async function (req, res) {
  try {
    const coachName = req.body.coachName;

    // Split the full name into first and last names
    const [firstName, lastName] = coachName.split(" ");

    const coachIDResult = db.query(`
      SELECT id
      FROM coach
      WHERE first_name = $1 AND last_name = $2
    `, [firstName, lastName]);

    const coachAttributesResult = db.query(`
      SELECT  nationality, birthyear
      FROM coach
      WHERE first_name = $1 AND last_name = $2
    `, [firstName, lastName]);

    // Extract the coachID from the result
    const coachID = (await coachIDResult).rows[0]?.id;


    const coachDataResult = db.query(`
      SELECT r.rating, r.comments, u.email
      FROM reviews r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.coach_id = $1
    `, [coachID]);

    const [coachAttributes, coachData] = await Promise.all([
      coachAttributesResult,
      coachDataResult,
    ]);

    if (!coachID) {
      res.render("coachreview2.ejs", {
        coachName: coachName
      });
      return;
    }

    res.render("coachreview.ejs", {
      coachName: coachName,
      coachData: coachData.rows,
      coachAttributes: coachAttributes.rows,
    });

  } catch (error) {
    console.error("Error fetching coach review:", error);
    res.status(500).send("Internal Server Error");
  }
});



app.get("/submitcoachreview1",function(req,res)
{
    res.render("submitcoachreview.ejs");
});


app.post("/submitcoachreview1",function(req,res)
{
  const submittedCoachName = req.body.coachName;

    res.render("submitcoachreview.ejs",{
      coachName: submittedCoachName
    });
});


app.post("/submitcoachreview2", async function (req, res) {
  const submittedRating = req.body.rating;
  const submittedComments = req.body.comments;
  const submittedCoachName = req.body.coachName;
  const currentUser = req.session.user;
  console.log(currentUser);

  try {
    const result = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [currentUser.email]
    );

    console.log(result);

    if (result.rows.length > 0) {
      const userID = result.rows[0]?.id;

      if (!userID) {
        console.log("User ID not found");
        res.status(404).send("User not found");
        return;
      }

      // Split the full name into first and last names
      const [firstName, lastName] = submittedCoachName.split(" ");

      const coachIDResult = await db.query(`
        SELECT id
        FROM coach
        WHERE first_name = $1 AND last_name = $2
      `, [firstName, lastName]);

      console.log(coachIDResult);

      if (coachIDResult.rows.length > 0) {
        const coachID = coachIDResult.rows[0].id;

        await db.query(
          "INSERT INTO reviews (rating, comments, user_id, coach_id) VALUES ($1, $2, $3, $4)",
          [submittedRating, submittedComments, userID, coachID]
        );

        res.render("teams.ejs");
      } else {
        console.log("Player ID not found");
        res.status(404).send("Player not found");
      }
    } else {
      console.log("User ID not found");
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error fetching user ID:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/stats", function (req, res) {
  res.render("stats.ejs");
});

app.post("/stats", async function (req, res) {
  try {
    // Get top 3 points leaders
    const pointsLeaders = await db.query(
      'SELECT player_id, SUM(points) as total_points FROM stats GROUP BY player_id ORDER BY total_points DESC LIMIT 3;'
    );

    // Get top 3 rebounds leaders
    const reboundsLeaders = await db.query(
      'SELECT player_id, SUM(rebounds) as total_rebounds FROM stats GROUP BY player_id ORDER BY total_rebounds DESC LIMIT 3;'
    );

    // Get top 3 assists leaders
    const assistsLeaders = await db.query(
      'SELECT player_id, SUM(assists) as total_assists FROM stats GROUP BY player_id ORDER BY total_assists DESC LIMIT 3;'
    );

    // Get attributes for points leaders
    const pointsLeadersAttributes = await db.query(
      'SELECT first_name, last_name, team_name, role FROM player WHERE id IN ($1, $2, $3);',
      [pointsLeaders.rows[0]?.player_id, pointsLeaders.rows[1]?.player_id, pointsLeaders.rows[2]?.player_id]
    );

    // Get attributes for rebounds leaders
    const reboundsLeadersAttributes = await db.query(
      'SELECT first_name, last_name, team_name, role FROM player WHERE id IN ($1, $2, $3);',
      [reboundsLeaders.rows[0]?.player_id, reboundsLeaders.rows[1]?.player_id, reboundsLeaders.rows[2]?.player_id]
    );

    // Get attributes for assists leaders
    const assistsLeadersAttributes = await db.query(
      'SELECT first_name, last_name, team_name, role FROM player WHERE id IN ($1, $2, $3);',
      [assistsLeaders.rows[0]?.player_id, assistsLeaders.rows[1]?.player_id, assistsLeaders.rows[2]?.player_id]
    );

    res.render("stats.ejs", {
      pointsLeadersAttributes: pointsLeadersAttributes,
      pointsLeadersPoints: pointsLeaders,
      reboundsLeadersAttributes: reboundsLeadersAttributes,
      reboundsLeadersRebounds: reboundsLeaders,
      assistsLeadersAttributes: assistsLeadersAttributes,
      reboundsLeadersAssists: assistsLeaders
    });

  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.all("/reviews", async function (req, res) {
  try {
    // Extract query parameters for ordering and filtering
    const orderBy = req.query.orderBy || 'id';
    const filterBy = req.query.filterBy || 'all';
    const searchText = req.query.searchText || '';

    let reviewsDataQuery =
      'SELECT r.*, u.email ' +
      'FROM reviews r ' +
      'JOIN users u ON u.id = r.user_id ';

      // Adjust the query based on the selected filter
    if (filterBy !== 'all') {
      reviewsDataQuery += `WHERE r.${filterBy}_id IS NOT NULL `;
    }

    // Adjust the query based on the selected order
    if (orderBy === 'latest') {
      reviewsDataQuery += 'ORDER BY r.id DESC ';
    } else if (orderBy === 'user_id') {
      reviewsDataQuery += 'ORDER BY r.user_id ';
    } else if (orderBy === 'rating') {
      reviewsDataQuery += 'ORDER BY r.rating DESC ';
    }

     // Add search condition for email or comments
     if (searchText) {
      reviewsDataQuery += `AND (u.email ILIKE '%${searchText}%' OR r.comments ILIKE '%${searchText}%') `;
    }

    reviewsDataQuery += 'LIMIT 20;';

    // Execute the adjusted query
    const reviewsData = await db.query(reviewsDataQuery);

    const reviewsWithDetails = [];

    for (const review of reviewsData.rows) {
      let details;

      if (review.player_id !== null) {
        // Retrieve player details from the players table
        details = await db.query('SELECT * FROM player WHERE id = $1;', [review.player_id]);
      } else if (review.team_id !== null) {
        // Retrieve team details from the teams table
        details = await db.query('SELECT * FROM teams WHERE id = $1;', [review.team_id]);
      } else if (review.coach_id !== null) {
        // Retrieve coach details from the coaches table
        details = await db.query('SELECT * FROM coach WHERE id = $1;', [review.coach_id]);
      } else if (review.game_id !== null) {
        // Retrieve game details from the games table
        details = await db.query(`
          SELECT G.*, T1.name AS team1_name, T2.name AS team2_name
          FROM games G
          JOIN teams T1 ON G.team1id = T1.id
          JOIN teams T2 ON G.team2id = T2.id
          WHERE G.id = $1;
        `, [review.game_id]);
      }

      // Combine review and details data
      const reviewWithDetails = { review, details: details.rows[0] };
      reviewsWithDetails.push(reviewWithDetails);
    }

    res.render("review.ejs", {
      dataReviews: reviewsWithDetails
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/logout", function (req, res) {
  // Destroy the session
  req.session.destroy(function (err) {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).send("Internal Server Error");
    } else {
      // Redirect to the index page after logout
      res.redirect("/");
    }
  });
});


app.get("/updateUser", function (req, res) {
  // Destroy the session
  res.render("updateuser.ejs");
});

app.post("/updateUser", async function (req, res) {
  try {
    const currentUser = req.session.user;
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.password;

    // Retrieve the user's information from the database
    const userData = await db.query("SELECT * FROM users WHERE id = $1", [currentUser.id]);

    if (userData.rows.length > 0) {
      const user = userData.rows[0];
      const hashedOldPassword = crypto.createHash("md5").update(oldPassword).digest("hex");

      // Check if the entered old password matches the stored password
      if (hashedOldPassword === user.password) {
        // Hash the new password
        const hashedNewPassword = crypto.createHash("md5").update(newPassword).digest("hex");

        // Update the user's password in the database
        await db.query("UPDATE users SET password = $1 WHERE id = $2", [hashedNewPassword, currentUser.id]);

        // Set the success message
       
        res.render("home.ejs");
      } else {
        // Set the error message
        
        res.render("updateuser.ejs");
      }
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/deleteUser", async function (req, res) {
  try {
    const currentUser = req.session.user;

    // Perform the necessary database operation to delete the user's account
    // For example, you can use the user's ID to delete the user from the "users" table
    await db.query("DELETE FROM users WHERE id = $1", [currentUser.id]);

    // Destroy the session after deleting the account
    req.session.destroy(function (err) {
      if (err) {
        console.error("Error destroying session:", err);
        res.status(500).send("Internal Server Error");
      } else {
        // Redirect to the index page after successful account deletion
        res.redirect("/");
      }
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
