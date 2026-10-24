
using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using DudeClothing.Api.Models;

namespace DudeClothing.Api.Repositories;

public sealed class CategoryRepository
{
    private readonly string _connectionString;

    public CategoryRepository(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        _connectionString =
            configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "Connection string 'DefaultConnection' was not found. " +
                "Add it to the ConnectionStrings section in appsettings.json.");
    }

    private SqlConnection CreateConnection()
    {
        return new SqlConnection(_connectionString);
    }

    // GET: All categories.
    // Public callers can receive active categories only.
    // Administrators can request inactive categories too.
    public async Task<IReadOnlyList<Category>> GetAllAsync(
        bool includeInactive = false)
    {
        const string sql = """
            SELECT
                CategoryId,
                CategoryName,
                Description,
                IsActive
            FROM dbo.Categories
            WHERE @IncludeInactive = 1
               OR IsActive = 1
            ORDER BY CategoryName;
            """;

        var categories = new List<Category>();

        await using var connection = CreateConnection();
        await using var command = new SqlCommand(sql, connection);

        command.Parameters
            .Add("@IncludeInactive", SqlDbType.Bit)
            .Value = includeInactive;

        await connection.OpenAsync();

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            categories.Add(MapCategory(reader));
        }

        return categories;
    }

    // GET: Active category by ID.
    public async Task<Category?> GetByIdAsync(int id)
    {
        const string sql = """
            SELECT
                CategoryId,
                CategoryName,
                Description,
                IsActive
            FROM dbo.Categories
            WHERE CategoryId = @CategoryId
              AND IsActive = 1;
            """;

        return await GetCategoryByIdAsync(sql, id);
    }

    // GET: Category by ID, including inactive categories.
    // Intended for administrator operations.
    public async Task<Category?> GetByIdForAdminAsync(int id)
    {
        const string sql = """
            SELECT
                CategoryId,
                CategoryName,
                Description,
                IsActive
            FROM dbo.Categories
            WHERE CategoryId = @CategoryId;
            """;

        return await GetCategoryByIdAsync(sql, id);
    }

    private async Task<Category?> GetCategoryByIdAsync(
        string sql,
        int id)
    {
        await using var connection = CreateConnection();
        await using var command = new SqlCommand(sql, connection);

        command.Parameters
            .Add("@CategoryId", SqlDbType.Int)
            .Value = id;

        await connection.OpenAsync();

        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            return null;
        }

        return MapCategory(reader);
    }

    // Checks whether an active category already uses this name.
    // Excludes the category being updated, if an ID is supplied.
    public async Task<bool> CategoryNameExistsAsync(
        string categoryName,
        int? excludeCategoryId = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(categoryName);

        const string sql = """
            SELECT CASE
                WHEN EXISTS
                (
                    SELECT 1
                    FROM dbo.Categories
                    WHERE LOWER(LTRIM(RTRIM(CategoryName))) =
                          LOWER(LTRIM(RTRIM(@CategoryName)))
                      AND IsActive = 1
                      AND
                      (
                          @ExcludeCategoryId IS NULL
                          OR CategoryId <> @ExcludeCategoryId
                      )
                )
                THEN 1
                ELSE 0
            END;
            """;

        await using var connection = CreateConnection();
        await using var command = new SqlCommand(sql, connection);

        command.Parameters
            .Add("@CategoryName", SqlDbType.NVarChar, 100)
            .Value = categoryName.Trim();

        command.Parameters
            .Add("@ExcludeCategoryId", SqlDbType.Int)
            .Value = excludeCategoryId.HasValue
                ? excludeCategoryId.Value
                : DBNull.Value;

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();

        return Convert.ToInt32(result) == 1;
    }

    // Checks whether another active category has the same name.
    // Used before reactivating a category.
    public async Task<bool> CategoryNameExistsAsyncForActivation(int id)
    {
        const string sql = """
            SELECT CASE
                WHEN EXISTS
                (
                    SELECT 1
                    FROM dbo.Categories AS target
                    INNER JOIN dbo.Categories AS other
                        ON LOWER(LTRIM(RTRIM(other.CategoryName))) =
                           LOWER(LTRIM(RTRIM(target.CategoryName)))
                       AND other.CategoryId <> target.CategoryId
                       AND other.IsActive = 1
                    WHERE target.CategoryId = @CategoryId
                )
                THEN 1
                ELSE 0
            END;
            """;

        await using var connection = CreateConnection();
        await using var command = new SqlCommand(sql, connection);

        command.Parameters
            .Add("@CategoryId", SqlDbType.Int)
            .Value = id;

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();

        return Convert.ToInt32(result) == 1;
    }

    // CREATE: New categories are active by default.
    public async Task<int> CreateAsync(CategoryWriteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.CategoryName);

        const string sql = """
            INSERT INTO dbo.Categories
            (
                CategoryName,
                Description,
                IsActive
            )
            OUTPUT INSERTED.CategoryId
            VALUES
            (
                @CategoryName,
                @Description,
                1
            );
            """;

        await using var connection = CreateConnection();
        await using var command = new SqlCommand(sql, connection);

        AddWriteParameters(command, request);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();

        if (result is null || result == DBNull.Value)
        {
            throw new InvalidOperationException(
                "The category was not created or its ID was not returned.");
        }

        return Convert.ToInt32(result);
    }

    // UPDATE: Updates the name and description.
    public async Task<bool> UpdateAsync(
        int id,
        CategoryWriteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.CategoryName);

        const string sql = """
            UPDATE dbo.Categories
            SET CategoryName = @CategoryName,
                Description = @Description
            WHERE CategoryId = @CategoryId;
            """;

        await using var connection = CreateConnection();
        await using var command = new SqlCommand(sql, connection);

        AddWriteParameters(command, request);

        command.Parameters
            .Add("@CategoryId", SqlDbType.Int)
            .Value = id;

        await connection.OpenAsync();

        return await command.ExecuteNonQueryAsync() > 0;
    }

    // Activates or deactivates a category.
    public async Task<bool> SetActiveAsync(int id, bool isActive)
    {
        const string sql = """
            UPDATE dbo.Categories
            SET IsActive = @IsActive
            WHERE CategoryId = @CategoryId;
            """;

        await using var connection = CreateConnection();
        await using var command = new SqlCommand(sql, connection);

        command.Parameters
            .Add("@CategoryId", SqlDbType.Int)
            .Value = id;

        command.Parameters
            .Add("@IsActive", SqlDbType.Bit)
            .Value = isActive;

        await connection.OpenAsync();

        return await command.ExecuteNonQueryAsync() > 0;
    }

    // Soft-delete: keeps the database record but deactivates it.
    public Task<bool> DeactivateAsync(int id)
    {
        return SetActiveAsync(id, false);
    }

    private static void AddWriteParameters(
        SqlCommand command,
        CategoryWriteRequest request)
    {
        command.Parameters
            .Add("@CategoryName", SqlDbType.NVarChar, 100)
            .Value = request.CategoryName.Trim();

        command.Parameters
            .Add("@Description", SqlDbType.NVarChar, 500)
            .Value = string.IsNullOrWhiteSpace(request.Description)
                ? DBNull.Value
                : request.Description.Trim();
    }

    private static Category MapCategory(IDataRecord reader)
    {
        return new Category
        {
            CategoryId = Convert.ToInt32(reader["CategoryId"]),

            CategoryName =
                Convert.ToString(reader["CategoryName"])
                ?? string.Empty,

            Description = reader["Description"] == DBNull.Value
                ? null
                : Convert.ToString(reader["Description"]),

            IsActive = Convert.ToBoolean(reader["IsActive"])
        };
    }
}
