
using System.Data;
using DudeClothing.Api.Data;
using DudeClothing.Api.Models;
using Microsoft.Data.SqlClient;

namespace DudeClothing.Api.Repositories;

public sealed class ProductVariantRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public ProductVariantRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory
            ?? throw new ArgumentNullException(nameof(connectionFactory));
    }

    // Shared SELECT statement for product variants.
    // The trailing newline separates this SQL from appended WHERE clauses.
    private const string SelectColumns = """
        SELECT
            pv.VariantId,
            pv.ProductId,
            p.ProductName,
            pv.SKU,
            pv.Size,
            pv.Colour,
            pv.StockQuantity,
            pv.IsActive
        FROM dbo.ProductVariants AS pv
        INNER JOIN dbo.Products AS p
            ON p.ProductId = pv.ProductId
        """ + "\n";

    // GET: api/ProductVariants
    // Public users see active variants belonging to active products.
    // Administrators can include inactive variants and products.
    public async Task<List<ProductVariant>> GetAllAsync(
        bool includeInactive = false)
    {
        var sql = SelectColumns + """
            WHERE (@IncludeInactive = 1 OR pv.IsActive = 1)
              AND (@IncludeInactive = 1 OR p.IsActive = 1)
            ORDER BY p.ProductName, pv.Size, pv.Colour;
            """;

        var variants = new List<ProductVariant>();

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@IncludeInactive", SqlDbType.Bit).Value =
            includeInactive;

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            variants.Add(MapVariant(reader));
        }

        return variants;
    }

    // GET: api/ProductVariants/{id}
    // Returns an active variant only when its product and category are active.
    public async Task<ProductVariant?> GetByIdAsync(int variantId)
    {
        const string filters = """
            WHERE pv.VariantId = @VariantId
              AND pv.IsActive = 1
              AND p.IsActive = 1
              AND EXISTS
              (
                  SELECT 1
                  FROM dbo.Categories AS c
                  WHERE c.CategoryId = p.CategoryId
                    AND c.IsActive = 1
              );
            """;

        var sql = SelectColumns + filters;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@VariantId", SqlDbType.Int).Value = variantId;

        await using var reader = await command.ExecuteReaderAsync();

        return await reader.ReadAsync()
            ? MapVariant(reader)
            : null;
    }

    // Administrator lookup includes inactive records.
    public async Task<ProductVariant?> GetByIdForAdminAsync(int variantId)
    {
        var sql = SelectColumns + """
            WHERE pv.VariantId = @VariantId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@VariantId", SqlDbType.Int).Value = variantId;

        await using var reader = await command.ExecuteReaderAsync();

        return await reader.ReadAsync()
            ? MapVariant(reader)
            : null;
    }

    // Returns the parent product ID, including for inactive variants.
    public async Task<int?> GetParentProductIdAsync(int variantId)
    {
        const string sql = """
            SELECT ProductId
            FROM dbo.ProductVariants
            WHERE VariantId = @VariantId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@VariantId", SqlDbType.Int).Value = variantId;

        var result = await command.ExecuteScalarAsync();

        return result is null || result == DBNull.Value
            ? null
            : Convert.ToInt32(result);
    }

    // GET: api/ProductVariants/product/{productId}
    // Returns variants available to public users.
    public async Task<List<ProductVariant>> GetByProductIdAsync(int productId)
    {
        var sql = SelectColumns + """
            WHERE pv.ProductId = @ProductId
              AND pv.IsActive = 1
              AND p.IsActive = 1
              AND EXISTS
              (
                  SELECT 1
                  FROM dbo.Categories AS c
                  WHERE c.CategoryId = p.CategoryId
                    AND c.IsActive = 1
              )
            ORDER BY pv.Size, pv.Colour;
            """;

        var variants = new List<ProductVariant>();

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@ProductId", SqlDbType.Int).Value = productId;

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            variants.Add(MapVariant(reader));
        }

        return variants;
    }

    // Checks that the parent product and its category are active.
    public async Task<bool> ProductExistsAsync(int productId)
    {
        const string sql = """
            SELECT CASE
                WHEN EXISTS
                (
                    SELECT 1
                    FROM dbo.Products AS p
                    INNER JOIN dbo.Categories AS c
                        ON c.CategoryId = p.CategoryId
                    WHERE p.ProductId = @ProductId
                      AND p.IsActive = 1
                      AND c.IsActive = 1
                )
                THEN 1
                ELSE 0
            END;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@ProductId", SqlDbType.Int).Value = productId;

        var result = await command.ExecuteScalarAsync();

        return Convert.ToInt32(result) == 1;
    }

    // Checks whether an SKU exists, optionally excluding one variant.
    public async Task<bool> SkuExistsAsync(
        string sku,
        int? excludeVariantId = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sku);

        const string sql = """
            SELECT CASE
                WHEN EXISTS
                (
                    SELECT 1
                    FROM dbo.ProductVariants
                    WHERE SKU = @SKU
                      AND
                      (
                          @ExcludeVariantId IS NULL
                          OR VariantId <> @ExcludeVariantId
                      )
                )
                THEN 1
                ELSE 0
            END;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@SKU", SqlDbType.NVarChar, 50).Value =
            sku.Trim();

        command.Parameters.Add("@ExcludeVariantId", SqlDbType.Int).Value =
            excludeVariantId.HasValue
                ? excludeVariantId.Value
                : DBNull.Value;

        var result = await command.ExecuteScalarAsync();

        return Convert.ToInt32(result) == 1;
    }

    // CREATE: New variants are active by default.
    public async Task<int> CreateAsync(ProductVariantWriteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        ArgumentException.ThrowIfNullOrWhiteSpace(request.SKU);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Size);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Colour);

        const string sql = """
            INSERT INTO dbo.ProductVariants
                (ProductId, SKU, Size, Colour, StockQuantity, IsActive)
            OUTPUT INSERTED.VariantId
            VALUES
                (@ProductId, @SKU, @Size, @Colour, @StockQuantity, 1);
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        AddVariantParameters(command, request);

        var result = await command.ExecuteScalarAsync();

        if (result is null || result == DBNull.Value)
        {
            throw new InvalidOperationException(
                "The product variant was not created or its ID was not returned.");
        }

        return Convert.ToInt32(result);
    }

    // UPDATE: Updates variant details without changing its activation status.
    public async Task<bool> UpdateAsync(
        int variantId,
        ProductVariantWriteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        ArgumentException.ThrowIfNullOrWhiteSpace(request.SKU);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Size);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Colour);

        const string sql = """
            UPDATE dbo.ProductVariants
            SET ProductId = @ProductId,
                SKU = @SKU,
                Size = @Size,
                Colour = @Colour,
                StockQuantity = @StockQuantity
            WHERE VariantId = @VariantId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        AddVariantParameters(command, request);

        command.Parameters.Add("@VariantId", SqlDbType.Int).Value = variantId;

        return await command.ExecuteNonQueryAsync() > 0;
    }

    // Activates or deactivates a variant.
    public async Task<bool> SetActiveAsync(int variantId, bool isActive)
    {
        const string sql = """
            UPDATE dbo.ProductVariants
            SET IsActive = @IsActive
            WHERE VariantId = @VariantId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@VariantId", SqlDbType.Int).Value = variantId;
        command.Parameters.Add("@IsActive", SqlDbType.Bit).Value = isActive;

        return await command.ExecuteNonQueryAsync() > 0;
    }

    // Updates stock only for active variants.
    public async Task<bool> UpdateStockAsync(
        int variantId,
        int stockQuantity)
    {
        if (stockQuantity < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(stockQuantity),
                "Stock quantity cannot be negative.");
        }

        const string sql = """
            UPDATE dbo.ProductVariants
            SET StockQuantity = @StockQuantity
            WHERE VariantId = @VariantId
              AND IsActive = 1;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@VariantId", SqlDbType.Int).Value = variantId;
        command.Parameters.Add("@StockQuantity", SqlDbType.Int).Value =
            stockQuantity;

        return await command.ExecuteNonQueryAsync() > 0;
    }

    // Soft-delete: retain the record and mark it inactive.
    public Task<bool> DeactivateAsync(int variantId)
    {
        return SetActiveAsync(variantId, false);
    }

    private static void AddVariantParameters(
        SqlCommand command,
        ProductVariantWriteRequest request)
    {
        command.Parameters.Add("@ProductId", SqlDbType.Int).Value =
            request.ProductId;

        command.Parameters.Add("@SKU", SqlDbType.NVarChar, 50).Value =
            request.SKU.Trim();

        command.Parameters.Add("@Size", SqlDbType.NVarChar, 20).Value =
            request.Size.Trim();

        command.Parameters.Add("@Colour", SqlDbType.NVarChar, 50).Value =
            request.Colour.Trim();

        command.Parameters.Add("@StockQuantity", SqlDbType.Int).Value =
            request.StockQuantity;
    }

    private static ProductVariant MapVariant(IDataRecord reader)
    {
        return new ProductVariant
        {
            VariantId = reader.GetInt32(reader.GetOrdinal("VariantId")),
            ProductId = reader.GetInt32(reader.GetOrdinal("ProductId")),
            ProductName = reader.GetString(reader.GetOrdinal("ProductName")),
            SKU = reader.GetString(reader.GetOrdinal("SKU")),
            Size = reader.GetString(reader.GetOrdinal("Size")),
            Colour = reader.GetString(reader.GetOrdinal("Colour")),
            StockQuantity = reader.GetInt32(reader.GetOrdinal("StockQuantity")),
            IsActive = reader.GetBoolean(reader.GetOrdinal("IsActive"))
        };
    }
}
