// Use Vite env (import.meta.env) in the browser. Fall back to a relative path so
// dev server proxy can forward to the backend and cookies work same-origin.
const API_URL = import.meta.env.VITE_API_URL || "/api/v1";


const request = async (endpoint, options) => {
  const res = await fetch(`${API_URL}${endpoint}`, {
    credentials: "include", // important if using cookies
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};



export const registerUser = (data) => {
  return request("/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

export const loginUser = (data) => {
  return request("/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

export const checkUsername = async (username) => {
  const res = await fetch(
    `${API_URL}/users/check-username?username=${username}`
  );

  const data = await res.json();
  return data;
};


export const getCurrentUser = async () => {
  return request("/users/me", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    // body: JSON.stringify(data),
  });


  // const res = await fetch(
  //   `${API_URL}/users/me`
  // );
  // const data = await res.json();
  // return data;
};

export const getUserCredits = async () => {
  return request("/credits", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
};
