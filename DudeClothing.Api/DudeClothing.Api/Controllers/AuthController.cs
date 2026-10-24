
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DudeClothing.Api.Models;
using DudeClothing.Api.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authorization;

namespace DudeClothing.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthRepository _authRepository;
    private readonly IPasswordHasher<UserAccount> _passwordHasher;
    private readonly IConfiguration _configuration;

    public AuthController(
        AuthRepository authRepository,
        IPasswordHasher<UserAccount> passwordHasher,
        IConfiguration configuration)
    {
        _authRepository = authRepository;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var fullName = request.FullName.Trim();
        var email = request.Email.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(fullName) ||
            string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new
            {
                message = "Name, email, and password are required."
            });
        }

        if (fullName.Length < 2)
        {
            return BadRequest(new
            {
                message = "Full name must contain at least 2 characters."
            });
        }

        var existingUser = await _authRepository.GetByEmailAsync(email);

        if (existingUser is not null)
        {
            return Conflict(new
            {
                message = "An account with this email already exists."
            });
        }

        var newUser = new UserAccount
        {
            FullName = fullName,
            Email = email,
            Role = "Customer"
        };

        var passwordHash = _passwordHasher.HashPassword(
            newUser,
            request.Password);

        try
        {
            var userId = await _authRepository.CreateAsync(
                fullName,
                email,
                passwordHash);

            return StatusCode(StatusCodes.Status201Created, new
            {
                message = "Registration successful. You can now log in.",
                userId
            });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            // Handles two simultaneous registrations using the same email.
            return Conflict(new
            {
                message = "An account with this email already exists."
            });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _authRepository.GetByEmailAsync(email);

        if (user is null)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        var verificationResult = _passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            request.Password);

        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        var jwtKey = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT signing key is missing.");

        var issuer = _configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException("JWT issuer is missing.");

        var audience = _configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException("JWT audience is missing.");

        var keyBytes = Convert.FromBase64String(jwtKey);

        if (keyBytes.Length < 32)
        {
            throw new InvalidOperationException(
                "JWT signing key must contain at least 32 bytes.");
        }

        var signingKey = new SymmetricSecurityKey(keyBytes);

        var credentials = new SigningCredentials(
            signingKey,
            SecurityAlgorithms.HmacSha256);

        var now = DateTime.UtcNow;
        var expiresAt = now.AddMinutes(60);

        var claims = new[]
        {
            new Claim(
                JwtRegisteredClaimNames.Sub,
                user.UserId.ToString()),

            new Claim(
                ClaimTypes.NameIdentifier,
                user.UserId.ToString()),

            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),

            new Claim(
                JwtRegisteredClaimNames.Jti,
                Convert.ToHexString(RandomNumberGenerator.GetBytes(16)))
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: now,
            expires: expiresAt,
            signingCredentials: credentials);

        var tokenString = new JwtSecurityTokenHandler()
            .WriteToken(token);

        return Ok(new AuthResponse
        {
            Token = tokenString,
            ExpiresAtUtc = expiresAt,
            UserId = user.UserId,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role
        });
    }



    [Authorize]
    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        return Ok(new
        {
            userId = User.FindFirst(
                System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,

            fullName = User.Identity?.Name,

            email = User.FindFirst(
                System.Security.Claims.ClaimTypes.Email)?.Value,

            role = User.FindFirst(
                System.Security.Claims.ClaimTypes.Role)?.Value
        });
    }

}
