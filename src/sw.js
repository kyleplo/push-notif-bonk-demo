self.addEventListener("push", e => {
  e.waitUntil(self.registration.showNotification("Bonk!", {
    body: "You've been bonked!"
  }));
});