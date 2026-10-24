
using System.Data;
using System.Text;
using DudeClothing.Api.Data;
using DudeClothing.Api.Models;
using Microsoft.Data.SqlClient;

namespace DudeClothing.Api.Repositories;

public sealed class ProductRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public ProductRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    private static Product ReadProduct(IDataRecord reader)
    {
        return new Product
        {
            ProductId = reader.GetInt32(reader.GetOrdinal("ProductId")),
            ProductName = reader.GetString(reader.GetOrdinal("ProductName")),
            Description = reader.IsDBNull(reader.GetOrdinal("Description"))
                ? string.Empty
                : reader.GetString(reader.GetOrdinal("Description")),
            Price = reader.GetDecimal(reader.GetOrdinal("Price")),
            CategoryName = reader.GetString(reader.GetOrdinal("CategoryName")),
            ImageUrl = reader.IsDBNull(reader.GetOrdinal("ImageUrl"))
                ? null
                : reader.GetString(reader.GetOrdinal("ImageUrl")),
            StockQuantity = reader.GetInt32(reader.GetOrdinal("StockQuantity")),
            IsActive = reader.GetBoolean(reader.GetOrdinal("IsActive"))
        };
    }

    public async Task<List<Product>> GetAllAsync(
        int? categoryId = null,
        decimal? minPrice = null,
        decimal? maxPrice = null,
        string? term = null,
        string? sortBy = "ProductId",
        string? sortDirection = "asc",
        int page = 1,
        int pageSize = 20,
        bool includeInactive = false)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100)
        {
            throw new ArgumentOutOfRangeException(
                nameof(page),
                "Page must be positive and pageSize must be between 1 and 100.");
        }

        var sql = new StringBuilder();

        sql.AppendLine("""
            SELECT
                p.ProductId,
                p.ProductName,
                p.Description,
                p.Price,
                p.IsActive,
                c.CategoryName,
                pi.ImageUrl,
                COALESCE(
                    SUM(
                        CASE
                            WHEN pv.IsActive = 1 THEN pv.StockQuantity
                            ELSE 0
                        END
                    ),
                    0
                ) AS StockQuantity
            FROM dbo.Products AS p
            INNER JOIN dbo.Categories AS c
                ON c.CategoryId = p.CategoryId
            LEFT JOIN dbo.ProductImages AS pi
                ON pi.ProductId = p.ProductId
                AND pi.IsPrimary = 1
            LEFT JOIN dbo.ProductVariants AS pv
                ON pv.ProductId = p.ProductId
            WHERE (@IncludeInactive = 1 OR p.IsActive = 1)
              AND (@IncludeInactive = 1 OR c.IsActive = 1)
            """);

        if (categoryId.HasValue)
            sql.AppendLine("AND p.CategoryId = @CategoryId");

        if (minPrice.HasValue)
            sql.AppendLine("AND p.Price >= @MinPrice");

        if (maxPrice.HasValue)
            sql.AppendLine("AND p.Price <= @MaxPrice");

        if (!string.IsNullOrWhiteSpace(term))
        {
            sql.AppendLine("""
                AND (
                    p.ProductName LIKE @Term
                    OR p.Description LIKE @Term
                )
                """);
        }

        sql.AppendLine("""
            GROUP BY
                p.ProductId,
                p.ProductName,
                p.Description,
                p.Price,
                p.IsActive,
                c.CategoryName,
                pi.ImageUrl
            """);

        var sortColumns = new Dictionary<string, string>(
            StringComparer.OrdinalIgnoreCase)
        {
            ["ProductId"] = "p.ProductId",
            ["ProductName"] = "p.ProductName",
            ["Price"] = "p.Price"
        };

        var orderColumn =
            sortColumns.TryGetValue(sortBy ?? "", out var column)
                ? column
                : "p.ProductId";

        var orderDirection =
            string.Equals(
                sortDirection,
                "desc",
                StringComparison.OrdinalIgnoreCase)
                ? "DESC"
                : "ASC";

        sql.AppendLine($"""
            ORDER BY {orderColumn} {orderDirection}
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY;
            """);

        var products = new List<Product>();

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = connection.CreateCommand();
        command.CommandText = sql.ToString();

        command.Parameters.Add("@IncludeInactive", SqlDbType.Bit).Value =
            includeInactive;

        if (categoryId.HasValue)
        {
            command.Parameters.Add("@CategoryId", SqlDbType.Int).Value =
                categoryId.Value;
        }

        if (minPrice.HasValue)
        {
            var parameter = command.Parameters.Add(
                "@MinPrice", SqlDbType.Decimal);
            parameter.Precision = 18;
            parameter.Scale = 2;
            parameter.Value = minPrice.Value;
        }

        if (maxPrice.HasValue)
        {
            var parameter = command.Parameters.Add(
                "@MaxPrice", SqlDbType.Decimal);
            parameter.Precision = 18;
            parameter.Scale = 2;
            parameter.Value = maxPrice.Value;
        }

        if (!string.IsNullOrWhiteSpace(term))
        {
            command.Parameters.Add("@Term", SqlDbType.NVarChar, 302).Value =
                $"%{term.Trim()}%";
        }

        command.Parameters.Add("@Offset", SqlDbType.Int).Value =
            (page - 1) * pageSize;

        command.Parameters.Add("@PageSize", SqlDbType.Int).Value = pageSize;

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            products.Add(ReadProduct(reader));
        }

        return products;
    }

    public async Task<Product?> GetByIdAsync(int productId)
    {
        const string sql = """
            SELECT
                p.ProductId,
                p.ProductName,
                p.Description,
                p.Price,
                p.IsActive,
                c.CategoryName,
                pi.ImageUrl,
                COALESCE(
                    SUM(
                        CASE
                            WHEN pv.IsActive = 1 THEN pv.StockQuantity
                            ELSE 0
                        END
                    ),
                    0
                ) AS StockQuantity
            FROM dbo.Products AS p
            INNER JOIN dbo.Categories AS c
                ON c.CategoryId = p.CategoryId
            LEFT JOIN dbo.ProductImages AS pi
                ON pi.ProductId = p.ProductId
                AND pi.IsPrimary = 1
            LEFT JOIN dbo.ProductVariants AS pv
                ON pv.ProductId = p.ProductId
            WHERE p.ProductId = @ProductId
              AND p.IsActive = 1
              AND c.IsActive = 1
            GROUP BY
                p.ProductId,
                p.ProductName,
                p.Description,
                p.Price,
                p.IsActive,
                c.CategoryName,
                pi.ImageUrl;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.Add("@ProductId", SqlDbType.Int).Value = productId;

        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
            return null;

        return ReadProduct(reader);
    }

    public async Task<int> CreateAsync(ProductWriteRequest request)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                INSERT INTO dbo.Products
                    (CategoryId, ProductName, Description, Price, IsActive)
                OUTPUT INSERTED.ProductId
                VALUES
                    (@CategoryId, @ProductName, @Description, @Price, 1);
                """;

            AddProductParameters(command, request);

            var result = await command.ExecuteScalarAsync();
            var productId = Convert.ToInt32(result);

            if (!string.IsNullOrWhiteSpace(request.ImageUrl))
            {
                await using var imageCommand = connection.CreateCommand();
                imageCommand.Transaction = transaction;
                imageCommand.CommandText = """
                    INSERT INTO dbo.ProductImages
                        (ProductId, ImageUrl, AltText, IsPrimary,
                         SortOrder, CreatedAt)
                    VALUES
                        (@ProductId, @ImageUrl, @AltText, 1, 1, SYSUTCDATETIME());
                    """;

                imageCommand.Parameters.Add("@ProductId", SqlDbType.Int).Value =
                    productId;

                imageCommand.Parameters.Add(
                    "@ImageUrl", SqlDbType.NVarChar, 1000).Value =
                    request.ImageUrl;

                imageCommand.Parameters.Add(
                    "@AltText", SqlDbType.NVarChar, 250).Value =
                    request.ProductName.Trim();

                await imageCommand.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
            return productId;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> UpdateAsync(
        int productId,
        ProductWriteRequest request)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                UPDATE dbo.Products
                SET CategoryId = @CategoryId,
                    ProductName = @ProductName,
                    Description = @Description,
                    Price = @Price
                WHERE ProductId = @ProductId
                  AND IsActive = 1;
                """;

            AddProductParameters(command, request);

            command.Parameters.Add("@ProductId", SqlDbType.Int).Value =
                productId;

            var rows = await command.ExecuteNonQueryAsync();

            if (rows == 0)
            {
                await transaction.RollbackAsync();
                return false;
            }

            if (!string.IsNullOrWhiteSpace(request.ImageUrl))
            {
                await using var imageCommand = connection.CreateCommand();
                imageCommand.Transaction = transaction;
                imageCommand.CommandText = """
                    IF EXISTS (
                        SELECT 1
                        FROM dbo.ProductImages
                        WHERE ProductId = @ProductId AND IsPrimary = 1
                    )
                    BEGIN
                        UPDATE dbo.ProductImages
                        SET ImageUrl = @ImageUrl,
                            AltText = @AltText
                        WHERE ProductId = @ProductId AND IsPrimary = 1;
                    END
                    ELSE
                    BEGIN
                        INSERT INTO dbo.ProductImages
                            (ProductId, ImageUrl, AltText, IsPrimary,
                             SortOrder, CreatedAt)
                        VALUES
                            (@ProductId, @ImageUrl, @AltText, 1, 1, SYSUTCDATETIME());
                    END;
                    """;

                imageCommand.Parameters.Add("@ProductId", SqlDbType.Int).Value =
                    productId;

                imageCommand.Parameters.Add(
                    "@ImageUrl", SqlDbType.NVarChar, 1000).Value =
                    request.ImageUrl;

                imageCommand.Parameters.Add(
                    "@AltText", SqlDbType.NVarChar, 250).Value =
                    request.ProductName.Trim();

                await imageCommand.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> SetActiveAsync(int productId, bool isActive)
    {
        const string sql = """
            UPDATE dbo.Products
            SET IsActive = @IsActive
            WHERE ProductId = @ProductId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@ProductId", SqlDbType.Int).Value = productId;
        command.Parameters.Add("@IsActive", SqlDbType.Bit).Value = isActive;

        return await command.ExecuteNonQueryAsync() > 0;
    }

    public async Task<bool> DeactivateAsync(int productId)
    {
        return await SetActiveAsync(productId, false);
    }

    private static void AddProductParameters(
        SqlCommand command,
        ProductWriteRequest request)
    {
        command.Parameters.Add("@CategoryId", SqlDbType.Int).Value =
            request.CategoryId;

        command.Parameters.Add("@ProductName", SqlDbType.NVarChar, 150).Value =
            request.ProductName.Trim();

        command.Parameters.Add("@Description", SqlDbType.NVarChar, -1).Value =
            string.IsNullOrWhiteSpace(request.Description)
                ? string.Empty
                : request.Description.Trim();

        var priceParameter = command.Parameters.Add(
            "@Price", SqlDbType.Decimal);

        priceParameter.Precision = 18;
        priceParameter.Scale = 2;
        priceParameter.Value = request.Price;
    }
}
