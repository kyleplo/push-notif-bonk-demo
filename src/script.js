var registration, subscription;

window.addEventListener("load", async () => {
  if(!("serviceWorker" in navigator) || !("PushManager" in window)){
    return;
  }

  const storedKey = localStorage.getItem("push-bonk-sub-key");

  if(storedKey){
    const checkKeyRequest = await fetch("/api/bonk/" + storedKey);

    if(checkKeyRequest.status === 200){
      document.querySelector("#keyToBonk").value = storedKey;
      document.querySelector("#status").textContent = `Already subscribed, restored key ${storedKey} from localStorage.`;
    }else{
      document.querySelector("#subscribe").removeAttribute("disabled");
    }
  }else{
    document.querySelector("#subscribe").removeAttribute("disabled");
  }

  registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if(!registration){
    registration = await navigator.serviceWorker.register("/sw.js");
  }

  document.querySelector("#subscribe").addEventListener("click", async e => {
    e.target.setAttribute("disabled", "disabled");

    var permission = Notification.permission;

    if(Notification.permission === "default"){
      permission = await Notification.requestPermission();
    }

    if(permission !== "granted"){
      alert("Notification permission denied");
      return;
    }

    subscription = await registration.pushManager.getSubscription();
    if(!subscription){
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(atob((await fetch("/api/public-key").then(r => r.json())).publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
      });
    }

    const keyRequest = await fetch("/api/subscribe", {
      method: "PUT",
      body: JSON.stringify(subscription)
    });

    if(keyRequest.status !== 200){
      alert("Failed to subscribe, check console");
      return;
    }

    const keyData = await keyRequest.json();

    localStorage.setItem("push-bonk-sub-key", keyData.key);
    document.querySelector("#keyToBonk").value = keyData.key;
    document.querySelector("#status").textContent = `Subscribed! Your key is ${keyData.key}`;
  });

  document.querySelector("#bonk").addEventListener("click", async e => {
    document.querySelector("#keyToBonk").setAttribute("disabled", "disabled");
    e.target.setAttribute("disabled", "disabled");

    const bonkRequest = await fetch("/api/bonk/" + document.querySelector("#keyToBonk").value, {
      method: "PUT"
    });

    if(bonkRequest.status !== 200){
      alert("Notification failed to dispatch, check console");
    }

    e.target.removeAttribute("disabled");
    document.querySelector("#keyToBonk").removeAttribute("disabled");
  });
});