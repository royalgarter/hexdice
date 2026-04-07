import {serve} from "https://deno.land/std/http/server.ts";
import {exists} from "https://deno.land/std/fs/mod.ts";
import {extname} from "https://deno.land/std/path/mod.ts";
import { marked } from 'https://esm.sh/marked@12.0.0';

const head_json = {
	"Content-Type": "application/json; charset=utf-8"
};
const cors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

async function handleRequest(req: Request) {
	const {pathname, searchParams} = new URL(req.url);

	const localpath = `./${pathname}`;

	// console.log(pathname, params);
	const response = (data, options) => {
		// console.log(pathname, 'responsed');
		return new Response(data, options);
	}

	if (pathname === "/") {
		return response(await Deno.readTextFile("./index.html"), {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "public, max-age=604800",
			}
		});
	}

	if (pathname === "/rules" || pathname === "/rules.md" || (pathname.startsWith("/rules/") && pathname.endsWith(".md"))) {
		const targetPath = pathname === "/rules" ? "./rules.md" : localpath;
		if (await exists(targetPath)) {
			const markdown = await Deno.readTextFile(targetPath);
			const html = marked.parse(markdown);
			/*const html = `<!DOCTYPE html>
				<html lang="en">
				  <head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<style>
						main {
							max-width: 800px;
							margin: 0 auto;
							padding: 2rem 1rem;
						}
						main pre code {
							letter-spacing: 0.3rem;
						}
						main img {
							padding-left: 100px;
						}
					  ${CSS}
					</style>
				  </head>
				  <body data-color-mode="auto" data-light-theme="light" data-dark-theme="dark" class="markdown-body">
					<main>
					  ${body}
					</main>
				  </body>
				</html>`;*/
			return response(html, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				}
			});
		}
	}

	if (await exists(localpath)) {
		return response(await Deno.readFile(localpath), {
			headers: {
				"Content-Type": `${extname(localpath) ?? "text/plain"}; charset=utf-8`,
				"Cache-Control": "public, max-age=604800",
			}
		})
	}

	return response(JSON.stringify({error: 'E404'}), {status: 404});
}

let port = 1134;try {port = process.env.PORT || port} catch{}
serve(handleRequest, {port});