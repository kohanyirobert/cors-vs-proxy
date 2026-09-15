var builder = WebApplication.CreateBuilder(args);

/* UNCOMMENT ME 👋
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));
*/

var app = builder.Build();

/* UNCOMMENT ME 👋
app.UseCors();
*/

app.MapPost("/api/register", (HttpRequest request) =>
{
    Console.WriteLine("Got POST!");

    return Results.Ok(new
    {
        message = "Received POST!",
    });
});

app.Run();
