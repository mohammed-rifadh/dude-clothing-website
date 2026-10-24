
using Microsoft.Data.SqlClient;

namespace DudeClothing.Api.Data;

public sealed class DbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString =
            configuration.GetConnectionString("DudeClothingDb")
            ?? throw new InvalidOperationException(
                "Connection string 'DudeClothingDb' was not found. " +
                "Check your User Secrets configuration.");
    }

    public SqlConnection CreateConnection()
    {
        return new SqlConnection(_connectionString);
    }
}
