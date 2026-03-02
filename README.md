<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Nu4xKoPpt7Nszf5KC23z0nPTV4ZsHGL2

## Setup for Collaborators

### 1. Version Control (GitHub)
To share this project with others:
- Create a new repository on [GitHub](https://github.com/new).
- Push this local repository to GitHub:
  ```bash
  git remote add origin <your-repo-url>
  git branch -M main
  git push -u origin main
  ```
- Go to **Settings > Collaborators** on GitHub and invite your team members.

### 2. Environment Variables
Copy the template to create your local environment file:
```bash
cp .env.example .env.local
```
Fill in the following keys in `.env.local`:
- `VITE_TEXTBEE_API_KEY`: Your TextBee API key.
- `VITE_TEXTBEE_DEVICE_ID`: Your TextBee Device ID.
- `GEMINI_API_KEY`: Your Google Gemini API key.

### 3. Firebase Access
To allow others to manage the database and functions:
- Go to the [Firebase Console](https://console.firebase.google.com/).
- Select your project: `ayush-ayurveda-8623a`.
- Go to **Project Settings > Users and permissions**.
- Click **Add member** and enter their email address.
- Assign appropriate roles (e.g., `Editor` or `Firebase Admin`).

### 4. Running Locally
1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
