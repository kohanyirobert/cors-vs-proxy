const PROXY_URL = "/api/register"
const DIRECT_URL = "http://localhost:8080/api/register"

function App() {
    const send = async (url) => {
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "test@test.com", password: "test" }),
        })
        const text = await resp.text()
        console.log("resp", resp)
        console.log("text", text)
    }

    return (
        <main>
            <h1>Hey 👋</h1>
            <div className="buttons">
                <button onClick={() => send(PROXY_URL)}>
                    Send POST to {PROXY_URL}
                </button>
                <button onClick={() => send(DIRECT_URL, "straight to the backend")}>
                    Send POST to {DIRECT_URL}
                </button>
            </div>
        </main>
    )
}

export default App
