import {
  buildPushPayload,
} from '@block65/webcrypto-web-push';

function error(code, msg){
	return new Response(JSON.stringify({error: msg}), {
		headers: {
			"content-type": "application/json;charset=UTF-8",
		},
		status: code
	});
}

function json(j){
	return new Response(JSON.stringify(j), {
		headers: {
			"content-type": "application/json;charset=UTF-8",
		},
		status: 200
	});
}

function randomKey(){
  return Date.now().toString(36).slice(5, 8) + Math.random().toString(36).slice(2, 5);
}

async function isSubscriptionValid(s, env){
	if(typeof s.endpoint === "string" && s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string"){
		try {
			await buildPushPayload({
				data: "Bonk!",
				options: {
					ttl: 86400
				}
			}, s, {
				subject: env.VAPID_SUBJECT,
				publicKey: env.VAPID_PUBLIC_KEY,
				privateKey: env.VAPID_PRIVATE_KEY
			});
			return true;
		}catch (e){
			return false;
		}
	}else{
		return false;
	}
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if(request.method === "PUT" && url.pathname === "/api/subscribe"){
			try {
				const subscription = JSON.parse(await request.text());

				if(!await isSubscriptionValid(subscription, env)){
					throw "Invalid subscription.";
				}

				const key = randomKey();

				await env.BONK_SUBS.put(key, JSON.stringify(subscription), {expirationTtl: 86400});

				return json({
					"status": "Successfully subscribed.",
					"key": key
				})
			} catch {
				return error(400, "Invalid subscription.")
			}
		}else if(request.method === "PUT" && url.pathname.startsWith("/api/bonk/") && url.pathname.split("/")[3]){
			const value = await env.BONK_SUBS.get(url.pathname.split("/")[3]);

			if(value){
				const parsedValue = JSON.parse(value);

				const payload = await buildPushPayload({
					data: "Bonk!",
					options: {
						ttl: 86400
					}
				}, parsedValue, {
					subject: env.VAPID_SUBJECT,
					publicKey: env.VAPID_PUBLIC_KEY,
					privateKey: env.VAPID_PRIVATE_KEY
				});

				var res;
				try {
					res = await fetch(parsedValue.endpoint, payload);
				} catch (e){
					return error(502, "Failed to dispatch notification - fetch failed.")
				}

				if(res.status === 201){
					return json({
						"status": "Notification successfully dispatched."
					})
				}else if(res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410){
					await env.BONK_SUBS.delete(url.pathname.split("/")[3]);

					return json({
						"status": "Notification rejected by server, key disabled."
					});
				}else{
					return error(502, "Failed to dispatch notification - notification server reported error.");
				}
			}else{
				return error(404, "Key not found.");
			}
		}else if(request.method === "GET" && url.pathname.startsWith("/api/bonk/") && url.pathname.split("/")[3]){
			const value = await env.BONK_SUBS.get(url.pathname.split("/")[3]);

			if(value){
				return json({
					"status": "Key active."
				});
			}else{
				return error(404, "Key not found.");
			}
		}else if(request.method === "GET" && url.pathname === "/api/public-key"){
			return json({
				"publicKey": env.VAPID_PUBLIC_KEY
			});
		}else if(url.pathname.startsWith("/api/")){
			return error(404, "API endpoint not found.");
		}

		return env.ASSETS.fetch(request);
	},
};
