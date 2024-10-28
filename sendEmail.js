require("dotenv").config();
const nodemailer = require("nodemailer");
const axios = require("axios");
const moment = require("moment");

// GitHub API configuration
const GITHUB_USERNAME = "isaacgemal";
const GITHUB_API = "https://api.github.com";

// Configure GitHub API client
const githubClient = axios.create({
  baseURL: GITHUB_API,
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  },
});

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});

async function getRecentActivity() {
  const activities = {
    events: [],
    notifications: [],
    deployments: [],
    auditLogs: [],
  };

  try {
    // Get user's events
    const eventsResponse = await githubClient.get(
      `/users/${GITHUB_USERNAME}/events`
    );
    activities.events = eventsResponse.data.filter((event) =>
      moment(event.created_at).isAfter(moment().subtract(24, "hours"))
    );

    // Get notifications
    const notificationsResponse = await githubClient.get("/notifications", {
      params: { since: moment().subtract(24, "hours").toISOString() },
    });
    activities.notifications = notificationsResponse.data;

    // Get repository deployments (for accessible repos)
    const reposResponse = await githubClient.get(
      `/users/${GITHUB_USERNAME}/repos`
    );
    const repos = reposResponse.data;

    for (const repo of repos.slice(0, 10)) {
      // Limit to first 10 repos to avoid rate limiting
      const deploymentsResponse = await githubClient.get(
        `/repos/${repo.full_name}/deployments`,
        {
          params: { since: moment().subtract(24, "hours").toISOString() },
        }
      );
      activities.deployments.push(...deploymentsResponse.data);
    }

    return activities;
  } catch (error) {
    console.error("Error fetching GitHub data:", error);
    return activities;
  }
}

function formatActivityHTML(activities) {
  const style = `
    <style>
      .container { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      .header { background: #24292e; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
      .section { margin-bottom: 25px; }
      .section-title { color: #24292e; border-bottom: 2px solid #e1e4e8; padding-bottom: 8px; margin-bottom: 15px; }
      .event-item { padding: 10px; margin: 5px 0; background: #f6f8fa; border-radius: 3px; }
      .time { color: #586069; font-size: 0.9em; }
      .repo { color: #0366d6; text-decoration: none; }
      .notification { padding: 10px; margin: 5px 0; background: #fff3cd; border-radius: 3px; }
      .deployment { padding: 10px; margin: 5px 0; background: #d1ecf1; border-radius: 3px; }
      .no-activity { color: #586069; font-style: italic; }
    </style>
  `;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>${style}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>GitHub Activity Summary</h1>
          <p>Last 24 hours of activity for ${GITHUB_USERNAME}</p>
          <p>${moment().format("MMMM D, YYYY")}</p>
        </div>
  `;

  // Recent Events Section
  html += `
    <div class="section">
      <h2 class="section-title">Recent Activities</h2>
  `;

  if (activities.events.length === 0) {
    html +=
      '<p class="no-activity">No recent activities in the past 24 hours.</p>';
  } else {
    activities.events.forEach((event) => {
      const time = moment(event.created_at).format("HH:mm");
      const repo = event.repo.name;

      html += `<div class="event-item">`;
      html += `<span class="time">${time}</span> - `;

      switch (event.type) {
        case "PushEvent":
          const commits = event.payload.commits || [];
          html += `Pushed ${commits.length} commit(s) to <a class="repo" href="https://github.com/${repo}">${repo}</a>`;
          break;
        case "CreateEvent":
          html += `Created ${event.payload.ref_type} in <a class="repo" href="https://github.com/${repo}">${repo}</a>`;
          break;
        case "IssuesEvent":
          html += `${event.payload.action} issue in <a class="repo" href="https://github.com/${repo}">${repo}</a>`;
          break;
        case "PullRequestEvent":
          html += `${event.payload.action} PR in <a class="repo" href="https://github.com/${repo}">${repo}</a>`;
          break;
        default:
          html += `Activity in <a class="repo" href="https://github.com/${repo}">${repo}</a>`;
      }
      html += "</div>";
    });
  }

  // Notifications Section
  html += `
    <div class="section">
      <h2 class="section-title">Unread Notifications</h2>
  `;

  if (activities.notifications.length === 0) {
    html += '<p class="no-activity">No unread notifications.</p>';
  } else {
    activities.notifications.forEach((notification) => {
      html += `
        <div class="notification">
          <span class="time">${moment(notification.updated_at).format(
            "HH:mm"
          )}</span> - 
          ${notification.subject.type}: ${notification.subject.title}
          <br>
          <a class="repo" href="https://github.com/${
            notification.repository.full_name
          }">
            ${notification.repository.full_name}
          </a>
        </div>
      `;
    });
  }

  // Deployments Section
  if (activities.deployments.length > 0) {
    html += `
      <div class="section">
        <h2 class="section-title">Recent Deployments</h2>
    `;

    activities.deployments.forEach((deployment) => {
      html += `
        <div class="deployment">
          <span class="time">${moment(deployment.created_at).format(
            "HH:mm"
          )}</span> - 
          Deployment to ${deployment.environment} for 
          <a class="repo" href="https://github.com/${
            deployment.repository.full_name
          }">
            ${deployment.repository.full_name}
          </a>
        </div>
      `;
    });
  }

  html += `
      </div>
      <div style="color: #586069; font-size: 0.8em; margin-top: 20px; text-align: center;">
        Generated by GitHub Activity Dashboard
      </div>
    </div>
    </body>
    </html>
  `;

  return html;
}

async function sendActivityEmail() {
  try {
    const activities = await getRecentActivity();
    const htmlContent = formatActivityHTML(activities);

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: process.env.MY_EMAIL,
      subject: `GitHub Activity Summary - ${moment().format("YYYY-MM-DD")}`,
      html: htmlContent,
      // Also include a text version for email clients that don't support HTML
      text: "Please enable HTML to view this email.",
    };

    await transporter.sendMail(mailOptions);
    console.log("Activity email sent successfully");
  } catch (error) {
    console.error("Error sending activity email:", error);
  }
}

// Run the script
sendActivityEmail();

// To run this daily, you can add this line:
// setInterval(sendActivityEmail, 24 * 60 * 60 * 1000);
