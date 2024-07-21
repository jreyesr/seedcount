import {EmailMessage} from "cloudflare:email";
import {createMimeMessage} from "mimetext/browser";

type PayloadItem = {
	ts: string
} & (
	| { type: "image", label: string, image: string }
	| { type: "text", text: string }
	| { type: "data", tag: string, data: any }
	| { type: "error", tag: string, data: string }
	)
type Payload = PayloadItem[]

export default {
	async fetch(request, env): Promise<Response> {
		const payload = await request.json<Payload>()

		const msg = createMimeMessage();
		msg.setSender({name: "Seedcount Bug Reports", addr: "seedcount-bugreports@jreyesr.com"});
		msg.setRecipient(env.DEST_EMAIL);
		msg.setSubject("A bug report was sent from Seedcount");
		msg.addMessage({
			contentType: 'text/plain',
			data: JSON.stringify(payload.filter(l => l.type !== "image")),
		});
		let i = 1;
		for (const log of payload) {
			if (log.type === "image") {
				msg.addAttachment({
					filename: `${i}.png`,
					contentType: "image/png",
					data: log.image
				})
				i++
			}
		}

		const message = new EmailMessage(
			"seedcount-bugreports@jreyesr.com",
			env.DEST_EMAIL,
			msg.asRaw()
		);
		try {
			await env.EMAIL.send(message);
		} catch (e) {
			let message
			if (e instanceof Error) message = e.message
			else message = String(e)
			return new Response(message, {status: 500})
		}

		return new Response('{"status":"OK"}');
	},
} satisfies ExportedHandler<Env>;
