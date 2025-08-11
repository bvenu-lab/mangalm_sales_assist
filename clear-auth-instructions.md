# How to Clear Authentication

Since you're experiencing issues with automatic login, here are two ways to clear your authentication:

## Method 1: Browser Console (Immediate Solution)

1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Paste and run this command:

```javascript
localStorage.removeItem('auth_token'); 
localStorage.removeItem('user'); 
sessionStorage.clear(); 
window.location.href = '/login';
```

This will immediately clear your authentication and redirect you to the login page.

## Method 2: Clear Browser Storage

1. Open Developer Tools (F12)
2. Go to the Application tab (Chrome) or Storage tab (Firefox)
3. Find "Local Storage" in the left sidebar
4. Click on `http://localhost:3006`
5. Right-click and select "Clear" or manually delete the `auth_token` entry
6. Refresh the page

## Method 3: Use the Clear Auth Page

Navigate to: `http://localhost:3006/clear-auth`

(Note: If this gives a 404, use Method 1 or 2 above, then restart the frontend)

## Login Credentials

After clearing authentication, you can log in with:

- **Admin**: username: `admin`, password: `admin123`
- **User**: username: `user`, password: `user123`
- **Demo**: username: `demo`, password: `demo2025`