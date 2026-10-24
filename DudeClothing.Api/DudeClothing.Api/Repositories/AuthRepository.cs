
using DudeClothing.Api.Data;
using DudeClothing.Api.Models;
using Microsoft.Data.SqlClient;
using System.Data;

namespace DudeClothing.Api.Repositories;

public sealed class AuthRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public AuthRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<UserAccount?> GetByEmailAsync(string email)
    {
        const string sql = """
            SELECT UserId, FullName, Email, PasswordHash, Role
            FROM dbo.Users
            WHERE Email = @Email
              AND IsActive = 1;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@Email", SqlDbType.NVarChar, 256).Value = email;

        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            return null;
        }

        return new UserAccount
        {
            UserId = reader.GetInt32(reader.GetOrdinal("UserId")),
            FullName = reader.GetString(reader.GetOrdinal("FullName")),
            Email = reader.GetString(reader.GetOrdinal("Email")),
            PasswordHash = reader.GetString(reader.GetOrdinal("PasswordHash")),
            Role = reader.GetString(reader.GetOrdinal("Role"))
        };
    }

    public async Task<int> CreateAsync(
        string fullName,
        string email,
        string passwordHash)
    {
        const string sql = """
            INSERT INTO dbo.Users
                (FullName, Email, PasswordHash, Role, IsActive)
            OUTPUT INSERTED.UserId
            VALUES
                (@FullName, @Email, @PasswordHash, N'Customer', 1);
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@FullName", SqlDbType.NVarChar, 100)
            .Value = fullName;

        command.Parameters.Add("@Email", SqlDbType.NVarChar, 256)
            .Value = email;

        command.Parameters.Add("@PasswordHash", SqlDbType.NVarChar, 500)
            .Value = passwordHash;

        var result = await command.ExecuteScalarAsync();

        return Convert.ToInt32(result);
    }
}
