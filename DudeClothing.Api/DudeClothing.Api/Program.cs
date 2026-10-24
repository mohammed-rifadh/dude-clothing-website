
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using DudeClothing.Api.Data;
using DudeClothing.Api.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Controllers and Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT access token."
    });

    options.AddSecurityRequirement(document =>
        new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("Bearer", document)] = []
        });
});

// CORS: Allow the DUDE Clothing React/Vite frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("DudeClothingFrontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5180",
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175",
                "http://localhost:5178",
                "http://localhost:5184"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Database connection and repositories
builder.Services.AddSingleton<DbConnectionFactory>();

builder.Services.AddScoped<ProductRepository>();
builder.Services.AddScoped<CategoryRepository>();
builder.Services.AddScoped<ProductVariantRepository>();
builder.Services.AddScoped<ProductImageRepository>();

builder.Services.AddScoped<AuthRepository>();
builder.Services.AddScoped<OrderRepository>();
builder.Services.AddScoped<CartRepository>();

// Password hashing
builder.Services.AddScoped<
    IPasswordHasher<DudeClothing.Api.Models.UserAccount>,
    PasswordHasher<DudeClothing.Api.Models.UserAccount>>();

// Read JWT configuration from User Secrets or other configuration providers
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("JWT signing key is missing.");

var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("JWT issuer is missing.");

var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("JWT audience is missing.");

// JWT authentication
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            ValidateAudience = true,
            ValidAudience = jwtAudience,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Convert.FromBase64String(jwtKey)),

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Swagger in Development
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// CORS must run before authentication and authorization
app.UseCors("DudeClothingFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
