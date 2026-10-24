
using System.Data;
using DudeClothing.Api.Data;
using DudeClothing.Api.Models;
using DudeClothing.Api.Models.Orders;
using Microsoft.Data.SqlClient;

namespace DudeClothing.Api.Repositories;

public class OrderRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public OrderRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    // =========================================================
    // 1. CREATE ORDER DIRECTLY
    // =========================================================
    public async Task<Order> CreateAsync(
        int userId,
        CreateOrderRequest request)
    {
        if (userId <= 0)
            throw new ArgumentException("Invalid customer ID.");

        ValidateRequest(request);

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync(
                IsolationLevel.Serializable);

        try
        {
            var orderItems = new List<OrderItem>();
            decimal subtotal = 0m;

            // Validate each requested variant and reserve its stock.
            foreach (var requestedItem in request.Items)
            {
                const string selectSql = """
                    SELECT
                        v.ProductId,
                        v.SKU,
                        v.Size,
                        v.Colour,
                        v.StockQuantity,
                        p.ProductName,
                        p.Price
                    FROM dbo.ProductVariants AS v
                        WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.Products AS p
                        WITH (UPDLOCK, HOLDLOCK)
                        ON p.ProductId = v.ProductId
                    WHERE v.VariantId = @VariantId
                      AND v.IsActive = 1
                      AND p.IsActive = 1;
                    """;

                int productId;
                string sku;
                string size;
                string colour;
                string productName;
                int availableStock;
                decimal unitPrice;

                await using (var command = new SqlCommand(
                    selectSql, connection, transaction))
                {
                    command.Parameters.Add(
                        "@VariantId", SqlDbType.Int).Value =
                        requestedItem.VariantId;

                    await using var reader =
                        await command.ExecuteReaderAsync();

                    if (!await reader.ReadAsync())
                    {
                        throw new InvalidOperationException(
                            $"Variant {requestedItem.VariantId} " +
                            "does not exist or is inactive.");
                    }

                    productId = reader.GetInt32(0);
                    sku = reader.GetString(1);
                    size = reader.GetString(2);
                    colour = reader.GetString(3);
                    availableStock = reader.GetInt32(4);
                    productName = reader.GetString(5);
                    unitPrice = reader.GetDecimal(6);
                }

                if (unitPrice < 0)
                {
                    throw new InvalidOperationException(
                        $"Invalid price for {productName}.");
                }

                if (availableStock < requestedItem.Quantity)
                {
                    throw new InvalidOperationException(
                        $"Insufficient stock for {productName}. " +
                        $"Available stock: {availableStock}.");
                }

                const string updateStockSql = """
                    UPDATE dbo.ProductVariants
                    SET StockQuantity = StockQuantity - @Quantity
                    WHERE VariantId = @VariantId
                      AND IsActive = 1
                      AND StockQuantity >= @Quantity;
                    """;

                await using (var stockCommand = new SqlCommand(
                    updateStockSql, connection, transaction))
                {
                    stockCommand.Parameters.Add(
                        "@VariantId", SqlDbType.Int).Value =
                        requestedItem.VariantId;

                    stockCommand.Parameters.Add(
                        "@Quantity", SqlDbType.Int).Value =
                        requestedItem.Quantity;

                    int affectedRows =
                        await stockCommand.ExecuteNonQueryAsync();

                    if (affectedRows != 1)
                    {
                        throw new InvalidOperationException(
                            "Stock could not be reserved. " +
                            "Please refresh the product and try again.");
                    }
                }

                decimal lineTotal =
                    unitPrice * requestedItem.Quantity;

                subtotal += lineTotal;

                orderItems.Add(new OrderItem
                {
                    ProductId = productId,
                    VariantId = requestedItem.VariantId,
                    ProductName = productName,
                    SKU = sku,
                    Size = size,
                    Colour = colour,
                    UnitPrice = unitPrice,
                    Quantity = requestedItem.Quantity,
                    LineTotal = lineTotal
                });
            }

            decimal shippingCost = 0m;
            decimal totalAmount = subtotal + shippingCost;
            string orderNumber = GenerateOrderNumber();

            int orderId;
            DateTime createdAt;

            const string insertOrderSql = """
                INSERT INTO dbo.Orders
                (
                    UserId, OrderNumber, OrderStatus,
                    FullName, Email, PhoneNumber,
                    AddressLine1, AddressLine2, City,
                    PostalCode, Country, Subtotal,
                    ShippingCost, TotalAmount
                )
                OUTPUT INSERTED.OrderId, INSERTED.CreatedAt
                VALUES
                (
                    @UserId, @OrderNumber, 'Pending',
                    @FullName, @Email, @PhoneNumber,
                    @AddressLine1, @AddressLine2, @City,
                    @PostalCode, @Country, @Subtotal,
                    @ShippingCost, @TotalAmount
                );
                """;

            await using (var command = new SqlCommand(
                insertOrderSql, connection, transaction))
            {
                AddOrderHeaderParameters(
                    command, userId, orderNumber, request,
                    subtotal, shippingCost, totalAmount);

                await using var reader =
                    await command.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    throw new InvalidOperationException(
                        "The order could not be created.");
                }

                orderId = reader.GetInt32(0);
                createdAt = reader.GetDateTime(1);
            }

            await InsertOrderItemsAsync(
                connection, transaction, orderId, orderItems);

            await transaction.CommitAsync();

            return BuildOrder(
                orderId, userId, orderNumber, request,
                subtotal, shippingCost, totalAmount,
                createdAt, orderItems);
        }
        catch
        {
            if (transaction.Connection is not null)
                await transaction.RollbackAsync();

            throw;
        }
    }

    // =========================================================
    // 2. CHECKOUT FROM CART
    // Creates order, deducts stock, and clears cart atomically.
    // =========================================================
    public async Task<Order> CheckoutAsync(
        int userId,
        CheckoutRequest request)
    {
        if (userId <= 0)
            throw new ArgumentException("Invalid customer ID.");

        ArgumentNullException.ThrowIfNull(request);

        ValidateCheckoutRequest(request);

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync(
                IsolationLevel.Serializable);

        try
        {
            // Find and lock the customer's cart.
            const string cartSql = """
                SELECT CartId
                FROM dbo.Carts WITH (UPDLOCK, HOLDLOCK)
                WHERE UserId = @UserId;
                """;

            int cartId;

            await using (var command = new SqlCommand(
                cartSql, connection, transaction))
            {
                command.Parameters.Add(
                    "@UserId", SqlDbType.Int).Value = userId;

                object? result = await command.ExecuteScalarAsync();

                if (result is null || result == DBNull.Value)
                {
                    throw new InvalidOperationException(
                        "Your cart is empty.");
                }

                cartId = Convert.ToInt32(result);
            }

            // Read cart items and lock related records.
            const string itemsSql = """
                SELECT
                    ci.VariantId,
                    ci.Quantity,
                    v.ProductId,
                    v.SKU,
                    v.Size,
                    v.Colour,
                    v.StockQuantity,
                    v.IsActive,
                    p.ProductName,
                    p.Price,
                    p.IsActive
                FROM dbo.CartItems AS ci WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN dbo.ProductVariants AS v
                    WITH (UPDLOCK, HOLDLOCK)
                    ON v.VariantId = ci.VariantId
                INNER JOIN dbo.Products AS p
                    WITH (UPDLOCK, HOLDLOCK)
                    ON p.ProductId = v.ProductId
                WHERE ci.CartId = @CartId
                ORDER BY ci.VariantId;
                """;

            var orderItems = new List<OrderItem>();
            decimal subtotal = 0m;

            await using (var command = new SqlCommand(
                itemsSql, connection, transaction))
            {
                command.Parameters.Add(
                    "@CartId", SqlDbType.Int).Value = cartId;

                await using var reader =
                    await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    int variantId = reader.GetInt32(0);
                    int quantity = reader.GetInt32(1);
                    int productId = reader.GetInt32(2);
                    string sku = reader.GetString(3);
                    string size = reader.GetString(4);
                    string colour = reader.GetString(5);
                    int stock = reader.GetInt32(6);
                    bool variantIsActive = reader.GetBoolean(7);
                    string productName = reader.GetString(8);
                    decimal unitPrice = reader.GetDecimal(9);
                    bool productIsActive = reader.GetBoolean(10);

                    if (!variantIsActive || !productIsActive)
                    {
                        throw new InvalidOperationException(
                            $"{productName} is no longer available.");
                    }

                    if (quantity < 1 || quantity > 100)
                    {
                        throw new InvalidOperationException(
                            $"Invalid cart quantity for {productName}.");
                    }

                    if (unitPrice < 0)
                    {
                        throw new InvalidOperationException(
                            $"Invalid price for {productName}.");
                    }

                    if (stock < quantity)
                    {
                        throw new InvalidOperationException(
                            $"Insufficient stock for {productName}. " +
                            $"Available stock: {stock}.");
                    }

                    decimal lineTotal = unitPrice * quantity;
                    subtotal += lineTotal;

                    orderItems.Add(new OrderItem
                    {
                        ProductId = productId,
                        VariantId = variantId,
                        ProductName = productName,
                        SKU = sku,
                        Size = size,
                        Colour = colour,
                        UnitPrice = unitPrice,
                        Quantity = quantity,
                        LineTotal = lineTotal
                    });
                }
            }

            if (orderItems.Count == 0)
            {
                throw new InvalidOperationException(
                    "Your cart is empty.");
            }

            decimal shippingCost = 0m;
            decimal totalAmount = subtotal + shippingCost;
            string orderNumber = GenerateOrderNumber();

            // Insert order header.
            int orderId;
            DateTime createdAt;

            const string insertOrderSql = """
                INSERT INTO dbo.Orders
                (
                    UserId, OrderNumber, OrderStatus,
                    FullName, Email, PhoneNumber,
                    AddressLine1, AddressLine2, City,
                    PostalCode, Country, Subtotal,
                    ShippingCost, TotalAmount
                )
                OUTPUT INSERTED.OrderId, INSERTED.CreatedAt
                VALUES
                (
                    @UserId, @OrderNumber, 'Pending',
                    @FullName, @Email, @PhoneNumber,
                    @AddressLine1, @AddressLine2, @City,
                    @PostalCode, @Country, @Subtotal,
                    @ShippingCost, @TotalAmount
                );
                """;

            await using (var command = new SqlCommand(
                insertOrderSql, connection, transaction))
            {
                AddOrderHeaderParameters(
                    command, userId, orderNumber, request,
                    subtotal, shippingCost, totalAmount);

                await using var reader =
                    await command.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    throw new InvalidOperationException(
                        "The order could not be created.");
                }

                orderId = reader.GetInt32(0);
                createdAt = reader.GetDateTime(1);
            }

            // Insert order items and capture database-generated IDs.
            await InsertOrderItemsAsync(
                connection, transaction, orderId, orderItems);

            // Deduct stock with a final availability check.
            const string stockSql = """
                UPDATE dbo.ProductVariants
                SET StockQuantity = StockQuantity - @Quantity
                WHERE VariantId = @VariantId
                  AND IsActive = 1
                  AND StockQuantity >= @Quantity;
                """;

            foreach (var item in orderItems)
            {
                await using var command = new SqlCommand(
                    stockSql, connection, transaction);

                command.Parameters.Add(
                    "@VariantId", SqlDbType.Int).Value = item.VariantId;

                command.Parameters.Add(
                    "@Quantity", SqlDbType.Int).Value = item.Quantity;

                int affectedRows =
                    await command.ExecuteNonQueryAsync();

                if (affectedRows != 1)
                {
                    throw new InvalidOperationException(
                        "Stock changed during checkout. " +
                        "Please try again.");
                }
            }

            // Clear the cart inside the same transaction.
            const string clearCartSql = """
                DELETE FROM dbo.CartItems
                WHERE CartId = @CartId;

                UPDATE dbo.Carts
                SET UpdatedAt = SYSUTCDATETIME()
                WHERE CartId = @CartId;
                """;

            await using (var command = new SqlCommand(
                clearCartSql, connection, transaction))
            {
                command.Parameters.Add(
                    "@CartId", SqlDbType.Int).Value = cartId;

                await command.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();

            return BuildOrder(
                orderId, userId, orderNumber, request,
                subtotal, shippingCost, totalAmount,
                createdAt, orderItems);
        }
        catch
        {
            if (transaction.Connection is not null)
                await transaction.RollbackAsync();

            throw;
        }
    }

    // =========================================================
    // 3. GET ONE ORDER INCLUDING ITEMS
    // =========================================================
    public async Task<Order?> GetByIdAsync(int orderId)
    {
        if (orderId <= 0)
            return null;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        const string orderSql = """
            SELECT
                OrderId, UserId, OrderNumber, OrderStatus,
                FullName, Email, PhoneNumber,
                AddressLine1, AddressLine2, City,
                PostalCode, Country, Subtotal,
                ShippingCost, TotalAmount, CreatedAt, UpdatedAt
            FROM dbo.Orders
            WHERE OrderId = @OrderId;
            """;

        Order? order;

        await using (var command = new SqlCommand(
            orderSql, connection))
        {
            command.Parameters.Add(
                "@OrderId", SqlDbType.Int).Value = orderId;

            await using var reader = await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return null;

            order = ReadOrder(reader);
        }

        const string itemsSql = """
            SELECT
                OrderItemId, OrderId, ProductId, VariantId,
                ProductName, SKU, Size, Colour,
                UnitPrice, Quantity, LineTotal
            FROM dbo.OrderItems
            WHERE OrderId = @OrderId
            ORDER BY OrderItemId;
            """;

        await using (var command = new SqlCommand(
            itemsSql, connection))
        {
            command.Parameters.Add(
                "@OrderId", SqlDbType.Int).Value = orderId;

            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
                order.Items.Add(ReadOrderItem(reader));
        }

        return order;
    }

    // =========================================================
    // 4. GET ALL ORDERS OR ONE CUSTOMER'S ORDERS
    // =========================================================
    public async Task<List<Order>> GetOrdersAsync(int? userId = null)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        const string ordersSql = """
            SELECT
                OrderId, UserId, OrderNumber, OrderStatus,
                FullName, Email, PhoneNumber,
                AddressLine1, AddressLine2, City,
                PostalCode, Country, Subtotal,
                ShippingCost, TotalAmount, CreatedAt, UpdatedAt
            FROM dbo.Orders
            WHERE @UserId IS NULL OR UserId = @UserId
            ORDER BY CreatedAt DESC;
            """;

        var orders = new List<Order>();

        await using (var command = new SqlCommand(
            ordersSql, connection))
        {
            command.Parameters.Add("@UserId", SqlDbType.Int).Value =
                userId.HasValue ? userId.Value : DBNull.Value;

            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
                orders.Add(ReadOrder(reader));
        }

        if (orders.Count == 0)
            return orders;

        const string itemsSql = """
            SELECT
                oi.OrderItemId, oi.OrderId, oi.ProductId,
                oi.VariantId, oi.ProductName, oi.SKU,
                oi.Size, oi.Colour, oi.UnitPrice,
                oi.Quantity, oi.LineTotal
            FROM dbo.OrderItems AS oi
            INNER JOIN dbo.Orders AS o
                ON o.OrderId = oi.OrderId
            WHERE @UserId IS NULL OR o.UserId = @UserId
            ORDER BY oi.OrderId, oi.OrderItemId;
            """;

        var ordersById = orders.ToDictionary(o => o.OrderId);

        await using (var command = new SqlCommand(
            itemsSql, connection))
        {
            command.Parameters.Add("@UserId", SqlDbType.Int).Value =
                userId.HasValue ? userId.Value : DBNull.Value;

            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var item = ReadOrderItem(reader);

                if (ordersById.TryGetValue(item.OrderId, out var order))
                    order.Items.Add(item);
            }
        }

        return orders;
    }

    // =========================================================
    // 5. UPDATE ORDER STATUS
    // =========================================================
    public async Task<bool> UpdateStatusAsync(
        int orderId,
        string orderStatus)
    {
        if (orderId <= 0)
            throw new InvalidOperationException("Invalid order ID.");

        if (string.IsNullOrWhiteSpace(orderStatus))
            throw new InvalidOperationException("Order status is required.");

        string[] allowedStatuses =
        [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        string? newStatus = Array.Find(
            allowedStatuses,
            status => string.Equals(
                status,
                orderStatus.Trim(),
                StringComparison.OrdinalIgnoreCase));

        if (newStatus is null)
        {
            throw new InvalidOperationException(
                "Invalid order status. Allowed statuses: " +
                string.Join(", ", allowedStatuses) + ".");
        }

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync(
                IsolationLevel.Serializable);

        try
        {
            const string selectSql = """
                SELECT OrderStatus
                FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
                WHERE OrderId = @OrderId;
                """;

            string? currentStatus;

            await using (var command = new SqlCommand(
                selectSql, connection, transaction))
            {
                command.Parameters.Add(
                    "@OrderId", SqlDbType.Int).Value = orderId;

                object? result = await command.ExecuteScalarAsync();

                currentStatus =
                    result is null || result == DBNull.Value
                        ? null
                        : Convert.ToString(result);
            }

            if (currentStatus is null)
            {
                await transaction.RollbackAsync();
                return false;
            }

            bool transitionAllowed = currentStatus switch
            {
                "Pending" =>
                    newStatus is "Processing" or "Cancelled",

                "Processing" =>
                    newStatus is "Shipped" or "Cancelled",

                "Shipped" =>
                    newStatus == "Delivered",

                "Delivered" or "Cancelled" => false,

                _ => false
            };

            if (!transitionAllowed)
            {
                throw new InvalidOperationException(
                    $"Cannot change order status from " +
                    $"'{currentStatus}' to '{newStatus}'.");
            }

            const string updateStatusSql = """
                UPDATE dbo.Orders
                SET OrderStatus = @OrderStatus,
                    UpdatedAt = SYSUTCDATETIME()
                WHERE OrderId = @OrderId;
                """;

            await using (var command = new SqlCommand(
                updateStatusSql, connection, transaction))
            {
                command.Parameters.Add(
                    "@OrderId", SqlDbType.Int).Value = orderId;

                command.Parameters.Add(
                    "@OrderStatus", SqlDbType.NVarChar, 30).Value =
                    newStatus;

                int affectedRows = await command.ExecuteNonQueryAsync();

                if (affectedRows != 1)
                {
                    throw new InvalidOperationException(
                        "The order status could not be updated.");
                }
            }

            // Restore stock only when the order is cancelled
            // through a valid status transition.
            if (newStatus == "Cancelled")
            {
                const string restoreStockSql = """
                    UPDATE v
                    SET v.StockQuantity =
                        v.StockQuantity + itemTotals.TotalQuantity
                    FROM dbo.ProductVariants AS v
                    INNER JOIN
                    (
                        SELECT
                            VariantId,
                            SUM(Quantity) AS TotalQuantity
                        FROM dbo.OrderItems
                        WHERE OrderId = @OrderId
                        GROUP BY VariantId
                    ) AS itemTotals
                        ON itemTotals.VariantId = v.VariantId;
                    """;

                await using var command = new SqlCommand(
                    restoreStockSql, connection, transaction);

                command.Parameters.Add(
                    "@OrderId", SqlDbType.Int).Value = orderId;

                await command.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            if (transaction.Connection is not null)
                await transaction.RollbackAsync();

            throw;
        }
    }

    // =========================================================
    // 6. INSERT ORDER ITEMS AND RETRIEVE GENERATED IDs
    // =========================================================
    private static async Task InsertOrderItemsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        int orderId,
        List<OrderItem> items)
    {
        const string insertItemSql = """
            INSERT INTO dbo.OrderItems
            (
                OrderId, ProductId, VariantId, ProductName,
                SKU, Size, Colour, UnitPrice, Quantity, LineTotal
            )
            OUTPUT INSERTED.OrderItemId
            VALUES
            (
                @OrderId, @ProductId, @VariantId, @ProductName,
                @SKU, @Size, @Colour, @UnitPrice, @Quantity, @LineTotal
            );
            """;

        foreach (var item in items)
        {
            await using var command = new SqlCommand(
                insertItemSql, connection, transaction);

            AddOrderItemParameters(command, orderId, item);

            object? result = await command.ExecuteScalarAsync();

            if (result is null || result == DBNull.Value)
            {
                throw new InvalidOperationException(
                    "An order item could not be created.");
            }

            item.OrderItemId = Convert.ToInt32(result);
            item.OrderId = orderId;
        }
    }

    // =========================================================
    // 7. HEADER PARAMETERS: CHECKOUT REQUEST
    // =========================================================
    private static void AddOrderHeaderParameters(
        SqlCommand command,
        int userId,
        string orderNumber,
        CheckoutRequest request,
        decimal subtotal,
        decimal shippingCost,
        decimal totalAmount)
    {
        AddOrderHeaderParametersCore(
            command, userId, orderNumber,
            request.FullName, request.Email,
            request.PhoneNumber, request.AddressLine1,
            request.AddressLine2, request.City,
            request.PostalCode, request.Country,
            subtotal, shippingCost, totalAmount);
    }

    // =========================================================
    // 8. HEADER PARAMETERS: DIRECT ORDER REQUEST
    // =========================================================
    private static void AddOrderHeaderParameters(
        SqlCommand command,
        int userId,
        string orderNumber,
        CreateOrderRequest request,
        decimal subtotal,
        decimal shippingCost,
        decimal totalAmount)
    {
        AddOrderHeaderParametersCore(
            command, userId, orderNumber,
            request.FullName, request.Email,
            request.PhoneNumber, request.AddressLine1,
            request.AddressLine2, request.City,
            request.PostalCode, request.Country,
            subtotal, shippingCost, totalAmount);
    }

    // Shared implementation for both request types.
    private static void AddOrderHeaderParametersCore(
        SqlCommand command,
        int userId,
        string orderNumber,
        string fullName,
        string email,
        string phoneNumber,
        string addressLine1,
        string? addressLine2,
        string city,
        string? postalCode,
        string country,
        decimal subtotal,
        decimal shippingCost,
        decimal totalAmount)
    {
        command.Parameters.Add(
            "@UserId", SqlDbType.Int).Value = userId;

        command.Parameters.Add(
            "@OrderNumber", SqlDbType.NVarChar, 30).Value =
            orderNumber;

        command.Parameters.Add(
            "@FullName", SqlDbType.NVarChar, 100).Value =
            fullName.Trim();

        command.Parameters.Add(
            "@Email", SqlDbType.NVarChar, 256).Value =
            email.Trim();

        command.Parameters.Add(
            "@PhoneNumber", SqlDbType.NVarChar, 30).Value =
            phoneNumber.Trim();

        command.Parameters.Add(
            "@AddressLine1", SqlDbType.NVarChar, 200).Value =
            addressLine1.Trim();

        command.Parameters.Add(
            "@AddressLine2", SqlDbType.NVarChar, 200).Value =
            string.IsNullOrWhiteSpace(addressLine2)
                ? DBNull.Value
                : addressLine2.Trim();

        command.Parameters.Add(
            "@City", SqlDbType.NVarChar, 100).Value =
            city.Trim();

        command.Parameters.Add(
            "@PostalCode", SqlDbType.NVarChar, 20).Value =
            string.IsNullOrWhiteSpace(postalCode)
                ? DBNull.Value
                : postalCode.Trim();

        command.Parameters.Add(
            "@Country", SqlDbType.NVarChar, 100).Value =
            country.Trim();

        AddDecimalParameter(command, "@Subtotal", subtotal);
        AddDecimalParameter(command, "@ShippingCost", shippingCost);
        AddDecimalParameter(command, "@TotalAmount", totalAmount);
    }

    // =========================================================
    // 9. ORDER ITEM PARAMETERS
    // =========================================================
    private static void AddOrderItemParameters(
        SqlCommand command,
        int orderId,
        OrderItem item)
    {
        command.Parameters.Add(
            "@OrderId", SqlDbType.Int).Value = orderId;

        command.Parameters.Add(
            "@ProductId", SqlDbType.Int).Value = item.ProductId;

        command.Parameters.Add(
            "@VariantId", SqlDbType.Int).Value = item.VariantId;

        command.Parameters.Add(
            "@ProductName", SqlDbType.NVarChar, 200).Value =
            item.ProductName;

        command.Parameters.Add(
            "@SKU", SqlDbType.NVarChar, 100).Value = item.SKU;

        command.Parameters.Add(
            "@Size", SqlDbType.NVarChar, 40).Value = item.Size;

        command.Parameters.Add(
            "@Colour", SqlDbType.NVarChar, 100).Value = item.Colour;

        AddDecimalParameter(command, "@UnitPrice", item.UnitPrice);

        command.Parameters.Add(
            "@Quantity", SqlDbType.Int).Value = item.Quantity;

        AddDecimalParameter(command, "@LineTotal", item.LineTotal);
    }

    // =========================================================
    // 10. BUILD RESPONSE: CHECKOUT REQUEST
    // =========================================================
    private static Order BuildOrder(
        int orderId,
        int userId,
        string orderNumber,
        CheckoutRequest request,
        decimal subtotal,
        decimal shippingCost,
        decimal totalAmount,
        DateTime createdAt,
        List<OrderItem> items)
    {
        return BuildOrderCore(
            orderId, userId, orderNumber,
            request.FullName, request.Email,
            request.PhoneNumber, request.AddressLine1,
            request.AddressLine2, request.City,
            request.PostalCode, request.Country,
            subtotal, shippingCost, totalAmount,
            createdAt, items);
    }

    // =========================================================
    // 11. BUILD RESPONSE: DIRECT ORDER REQUEST
    // =========================================================
    private static Order BuildOrder(
        int orderId,
        int userId,
        string orderNumber,
        CreateOrderRequest request,
        decimal subtotal,
        decimal shippingCost,
        decimal totalAmount,
        DateTime createdAt,
        List<OrderItem> items)
    {
        return BuildOrderCore(
            orderId, userId, orderNumber,
            request.FullName, request.Email,
            request.PhoneNumber, request.AddressLine1,
            request.AddressLine2, request.City,
            request.PostalCode, request.Country,
            subtotal, shippingCost, totalAmount,
            createdAt, items);
    }

    private static Order BuildOrderCore(
        int orderId,
        int userId,
        string orderNumber,
        string fullName,
        string email,
        string phoneNumber,
        string addressLine1,
        string? addressLine2,
        string city,
        string? postalCode,
        string country,
        decimal subtotal,
        decimal shippingCost,
        decimal totalAmount,
        DateTime createdAt,
        List<OrderItem> items)
    {
        return new Order
        {
            OrderId = orderId,
            UserId = userId,
            OrderNumber = orderNumber,
            OrderStatus = "Pending",
            FullName = fullName.Trim(),
            Email = email.Trim(),
            PhoneNumber = phoneNumber.Trim(),
            AddressLine1 = addressLine1.Trim(),
            AddressLine2 = string.IsNullOrWhiteSpace(addressLine2)
                ? null
                : addressLine2.Trim(),
            City = city.Trim(),
            PostalCode = string.IsNullOrWhiteSpace(postalCode)
                ? null
                : postalCode.Trim(),
            Country = country.Trim(),
            Subtotal = subtotal,
            ShippingCost = shippingCost,
            TotalAmount = totalAmount,
            CreatedAt = createdAt,
            Items = items
        };
    }

    // =========================================================
    // 12. READ ORDER FROM SQL DATA READER
    // =========================================================
    private static Order ReadOrder(SqlDataReader reader)
    {
        return new Order
        {
            OrderId = reader.GetInt32(0),
            UserId = reader.GetInt32(1),
            OrderNumber = reader.GetString(2),
            OrderStatus = reader.GetString(3),
            FullName = reader.GetString(4),
            Email = reader.GetString(5),
            PhoneNumber = reader.GetString(6),
            AddressLine1 = reader.GetString(7),
            AddressLine2 = reader.IsDBNull(8)
                ? null : reader.GetString(8),
            City = reader.GetString(9),
            PostalCode = reader.IsDBNull(10)
                ? null : reader.GetString(10),
            Country = reader.GetString(11),
            Subtotal = reader.GetDecimal(12),
            ShippingCost = reader.GetDecimal(13),
            TotalAmount = reader.GetDecimal(14),
            CreatedAt = reader.GetDateTime(15),
            UpdatedAt = reader.IsDBNull(16)
                ? null : reader.GetDateTime(16)
        };
    }

    // =========================================================
    // 13. READ ORDER ITEM FROM SQL DATA READER
    // =========================================================
    private static OrderItem ReadOrderItem(SqlDataReader reader)
    {
        return new OrderItem
        {
            OrderItemId = reader.GetInt32(0),
            OrderId = reader.GetInt32(1),
            ProductId = reader.GetInt32(2),
            VariantId = reader.GetInt32(3),
            ProductName = reader.GetString(4),
            SKU = reader.GetString(5),
            Size = reader.GetString(6),
            Colour = reader.GetString(7),
            UnitPrice = reader.GetDecimal(8),
            Quantity = reader.GetInt32(9),
            LineTotal = reader.GetDecimal(10)
        };
    }

    // =========================================================
    // 14. VALIDATE DIRECT ORDER REQUEST
    // =========================================================
    private static void ValidateRequest(CreateOrderRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        ValidateDeliveryDetails(
            request.FullName,
            request.Email,
            request.PhoneNumber,
            request.AddressLine1,
            request.City,
            request.Country);

        if (request.Items is null || request.Items.Count == 0)
        {
            throw new InvalidOperationException(
                "An order must contain at least one item.");
        }

        if (request.Items.Count > 50)
        {
            throw new InvalidOperationException(
                "An order cannot contain more than 50 items.");
        }

        foreach (var item in request.Items)
        {
            if (item is null)
            {
                throw new InvalidOperationException(
                    "Order items cannot be null.");
            }

            if (item.VariantId <= 0)
            {
                throw new InvalidOperationException(
                    "Invalid product variant ID.");
            }

            if (item.Quantity < 1 || item.Quantity > 100)
            {
                throw new InvalidOperationException(
                    "Quantity must be between 1 and 100.");
            }
        }
    }

    // =========================================================
    // 15. VALIDATE CHECKOUT REQUEST
    // =========================================================
    private static void ValidateCheckoutRequest(CheckoutRequest request)
    {
        ValidateDeliveryDetails(
            request.FullName,
            request.Email,
            request.PhoneNumber,
            request.AddressLine1,
            request.City,
            request.Country);
    }

    private static void ValidateDeliveryDetails(
        string? fullName,
        string? email,
        string? phoneNumber,
        string? addressLine1,
        string? city,
        string? country)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ArgumentException("Full name is required.");

        if (fullName.Trim().Length > 100)
            throw new ArgumentException("Full name is too long.");

        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required.");

        if (email.Trim().Length > 256)
            throw new ArgumentException("Email is too long.");

        if (string.IsNullOrWhiteSpace(phoneNumber))
            throw new ArgumentException("Phone number is required.");

        if (phoneNumber.Trim().Length > 30)
            throw new ArgumentException("Phone number is too long.");

        if (string.IsNullOrWhiteSpace(addressLine1))
            throw new ArgumentException("Address is required.");

        if (addressLine1.Trim().Length > 200)
            throw new ArgumentException("Address is too long.");

        if (string.IsNullOrWhiteSpace(city))
            throw new ArgumentException("City is required.");

        if (city.Trim().Length > 100)
            throw new ArgumentException("City name is too long.");

        if (string.IsNullOrWhiteSpace(country))
            throw new ArgumentException("Country is required.");

        if (country.Trim().Length > 100)
            throw new ArgumentException("Country name is too long.");
    }

    // =========================================================
    // 16. GENERATE UNIQUE ORDER NUMBER
    // =========================================================
    private static string GenerateOrderNumber()
    {
        return
            $"ORD-{DateTime.UtcNow:yyMMddHHmmss}-" +
            Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
    }

    // =========================================================
    // 17. DECIMAL PARAMETERS FOR SQL SERVER
    // =========================================================
    private static void AddDecimalParameter(
        SqlCommand command,
        string parameterName,
        decimal value)
    {
        var parameter = command.Parameters.Add(
            parameterName, SqlDbType.Decimal);

        parameter.Precision = 12;
        parameter.Scale = 2;
        parameter.Value = value;
    }
}
